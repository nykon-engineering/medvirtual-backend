import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';

// One year in milliseconds — used for the eligibility window and referral-age rule.
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class CommissionDetectionService {
  private readonly logger = new Logger(CommissionDetectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Phase B Step 2: for every eligible HubspotInvoiceSnapshot belonging to the
   * referred organization, create an AffiliateCommission record idempotently.
   *
   * Eligibility rule (MA-003):
   *   - invoice_status === 'paid'
   *   - invoice_amount > 0
   *   - payment_status is null OR 'succeeded'
   *
   * Eligibility lifecycle:
   *   1. Before first paid invoice       → not_eligible, no commissions created.
   *   2. First paid invoice received     → transition to eligible, store anchor dates,
   *                                        then create commissions.
   *   3. Within one-year window          → eligible, commissions created normally.
   *   4. One year after eligibility_start_at → expire: set not_eligible, skip commissions.
   *   5. Referral older than one year with no first paid invoice → skip (referral-age rule).
   *   6. Active-client block             → skip permanently (block_reason prefix check).
   *
   * Idempotency: the idempotency_key is @unique in the DB.
   * If a commission already exists (Prisma P2002), the creation is silently skipped.
   *
   * @returns count of commissions created and skipped
   */
  async run(
    organizationId: string,
  ): Promise<{ created: number; skipped: number }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        referred_by_affiliate_id: true,
        med_alliance_referral_status: true,
        med_alliance_block_reason: true,
        eligibility_start_at: true,
        first_paid_invoice_at: true,
        createdAt: true,
      },
    });

    if (!org?.referred_by_affiliate_id) {
      this.logger.warn(`Org ${organizationId} has no affiliate — skipping commission detection`);
      return { created: 0, skipped: 0 };
    }

    // Permanent block: organization matched as an active MedVirtual client.
    if (org.med_alliance_block_reason?.startsWith('active_client_block')) {
      this.logger.log(`Org ${organizationId} has active-client block — skipping commission detection`);
      return { created: 0, skipped: 0 };
    }

    const now = new Date();

    // Eligibility window expiry: eligible but anchor is older than one year.
    if (
      org.med_alliance_referral_status === 'eligible' &&
      org.eligibility_start_at &&
      now.getTime() - org.eligibility_start_at.getTime() > ONE_YEAR_MS
    ) {
      await this.expireEligibility(organizationId);
      return { created: 0, skipped: 0 };
    }

    // Referral-age rule: never received a paid invoice AND referral itself is older than one year.
    if (
      org.med_alliance_referral_status === 'not_eligible' &&
      !org.first_paid_invoice_at &&
      now.getTime() - org.createdAt.getTime() > ONE_YEAR_MS
    ) {
      this.logger.log(`Org ${organizationId} referred > 1 year ago with no paid invoice — skipping`);
      return { created: 0, skipped: 0 };
    }

    // Window already expired in a prior run (first_paid_invoice_at set but status is not_eligible).
    if (org.med_alliance_referral_status === 'not_eligible' && org.first_paid_invoice_at) {
      this.logger.log(`Org ${organizationId} eligibility window expired — skipping commission detection`);
      return { created: 0, skipped: 0 };
    }

    // Load the affiliate's active profile to get the commission percentage.
    const profile = await this.prisma.affiliateProfile.findFirst({
      where: { user_id: org.referred_by_affiliate_id, status: 'active' },
      select: { id: true, user_id: true, commission_percent_default: true },
    });

    if (!profile) {
      this.logger.warn(
        `No active affiliate profile for user ${org.referred_by_affiliate_id} — skipping commission detection`,
      );
      return { created: 0, skipped: 0 };
    }

    // Fetch all candidate paid snapshots for this organization.
    const snapshots = await this.prisma.hubspotInvoiceSnapshot.findMany({
      where: {
        organization_id: organizationId,
        invoice_status: 'paid',
        invoice_amount: { gt: 0 },
      },
      select: {
        id: true,
        hubspot_id: true,
        invoice_amount: true,
        payment_status: true,
        paid_at: true,
      },
      orderBy: { paid_at: 'asc' },
    });

    const candidates = snapshots.filter(
      (s) => s.payment_status === null || s.payment_status === 'succeeded',
    );

    if (candidates.length === 0) {
      return { created: 0, skipped: 0 };
    }

    // First qualifying event: no prior paid invoice — transition org to eligible.
    if (org.med_alliance_referral_status === 'not_eligible' && !org.first_paid_invoice_at) {
      const firstInvoiceDate = candidates[0].paid_at ?? now;
      await this.activateEligibility(organizationId, firstInvoiceDate);
    }

    // Create commissions for all candidate snapshots.
    let created = 0;
    let skipped = 0;

    for (const snapshot of candidates) {
      const idempotencyKey = this.buildIdempotencyKey({
        affiliateId: profile.user_id!,
        hubspotInvoiceId: snapshot.hubspot_id,
        paidAt: snapshot.paid_at,
        baseAmount: snapshot.invoice_amount.toString(),
        commissionPercent: profile.commission_percent_default.toString(),
      });

      try {
        const commissionAmount = new Decimal(snapshot.invoice_amount)
          .mul(profile.commission_percent_default)
          .div(100)
          .toDecimalPlaces(2);

        await this.prisma.affiliateCommission.create({
          data: {
            affiliate_id: profile.user_id!,
            affiliate_profile_id: profile.id,
            organization_id: organizationId,
            hubspot_invoice_snapshot_id: snapshot.id,
            commission_percent_snapshot: profile.commission_percent_default,
            base_amount_snapshot: snapshot.invoice_amount,
            commission_amount: commissionAmount,
            status: 'detected',
            idempotency_key: idempotencyKey,
          },
        });

        await this.prisma.medAllianceAuditLog.create({
          data: {
            entity_type: 'commission',
            entity_id: idempotencyKey,
            event: 'commission_detected',
            old_status: null,
            new_status: 'detected',
            reason: null,
            source: 'sync',
            actor_user_id: null,
            metadata: {
              organization_id: organizationId,
              hubspot_invoice_id: snapshot.hubspot_id,
            } as any,
          },
        });

        created++;
      } catch (err: any) {
        if (err?.code === 'P2002') {
          skipped++;
          continue;
        }
        this.logger.error(
          `Failed to create commission for snapshot ${snapshot.id}: ${err?.message ?? err}`,
        );
      }
    }

    this.logger.log(
      `Commission detection for org ${organizationId}: created=${created} skipped=${skipped}`,
    );

    return { created, skipped };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Transitions an organization to eligible on its first paid invoice.
   * Stores eligibility_start_at (anchor for the one-year window) and
   * first_paid_invoice_at (permanent audit field, never cleared).
   */
  private async activateEligibility(
    organizationId: string,
    firstInvoiceDate: Date,
  ): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        med_alliance_referral_status: 'eligible',
        eligibility_start_at: firstInvoiceDate,
        first_paid_invoice_at: firstInvoiceDate,
        med_alliance_block_reason: null,
      },
    });

    await this.prisma.medAllianceAuditLog.create({
      data: {
        entity_type: 'referred_company',
        entity_id: organizationId,
        event: 'eligibility_activated',
        old_status: 'not_eligible',
        new_status: 'eligible',
        reason: 'First paid invoice received — eligibility window started',
        source: 'sync',
        actor_user_id: null,
        metadata: { eligibility_start_at: firstInvoiceDate.toISOString() } as any,
      },
    });

    this.logger.log(
      `Org ${organizationId} transitioned to eligible — eligibility_start_at=${firstInvoiceDate.toISOString()}`,
    );
  }

  /**
   * Expires eligibility when the one-year window has passed.
   * Clears eligibility_start_at (so the stored status reflects reality)
   * but preserves first_paid_invoice_at as a permanent audit record.
   */
  private async expireEligibility(organizationId: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        med_alliance_referral_status: 'not_eligible',
        eligibility_start_at: null,
        med_alliance_block_reason: 'eligibility_expired: one-year window elapsed',
      },
    });

    await this.prisma.medAllianceAuditLog.create({
      data: {
        entity_type: 'referred_company',
        entity_id: organizationId,
        event: 'eligibility_expired',
        old_status: 'eligible',
        new_status: 'not_eligible',
        reason: 'One-year eligibility window elapsed',
        source: 'sync',
        actor_user_id: null,
        metadata: undefined,
      },
    });

    this.logger.log(`Org ${organizationId} eligibility window expired — status set to not_eligible`);
  }

  /**
   * Builds the SHA-256 idempotency key for a commission.
   * Composed of: affiliate_id | hubspot_invoice_id | paid_at | base_amount | commission_percent
   */
  private buildIdempotencyKey(params: {
    affiliateId: string;
    hubspotInvoiceId: string;
    paidAt: Date | null;
    baseAmount: string;
    commissionPercent: string;
  }): string {
    const payload = [
      params.affiliateId,
      params.hubspotInvoiceId,
      params.paidAt ? params.paidAt.toISOString() : '',
      params.baseAmount,
      params.commissionPercent,
    ].join('|');

    return createHash('sha256').update(payload).digest('hex');
  }
}
