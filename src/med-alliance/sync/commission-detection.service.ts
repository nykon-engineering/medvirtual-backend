import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';

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
   * Idempotency: the idempotency_key is @unique in the DB.
   * If a commission already exists (Prisma P2002), the creation is silently skipped.
   *
   * @returns count of commissions created and skipped
   */
  async run(
    organizationId: string,
  ): Promise<{ created: number; skipped: number }> {
    // Load the organization with its affiliate profile to get the commission rate
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        referred_by_affiliate_id: true,
        med_alliance_referral_status: true,
      },
    });

    if (!org?.referred_by_affiliate_id) {
      this.logger.warn(`Org ${organizationId} has no affiliate — skipping commission detection`);
      return { created: 0, skipped: 0 };
    }

    // Block: do not generate commissions for ineligible referrals
    if (org.med_alliance_referral_status === 'not_eligible_active_client') {
      this.logger.log(
        `Org ${organizationId} is blocked as active client — skipping commission detection`,
      );
      return { created: 0, skipped: 0 };
    }

    // Fetch the affiliate's active profile to get the commission percentage
    const profile = await this.prisma.affiliateProfile.findFirst({
      where: { user_id: org.referred_by_affiliate_id, status: 'active' },
      select: {
        id: true,
        user_id: true,
        commission_percent_default: true,
      },
    });

    if (!profile) {
      this.logger.warn(
        `No active affiliate profile for user ${org.referred_by_affiliate_id} — skipping commission detection`,
      );
      return { created: 0, skipped: 0 };
    }

    // Fetch all candidate-input snapshots for this organization
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
    });

    // Post-filter for payment_status edge case (cannot express cleanly as Prisma where)
    const candidates = snapshots.filter(
      (s) => s.payment_status === null || s.payment_status === 'succeeded',
    );

    let created = 0;
    let skipped = 0;

    for (const snapshot of candidates) {
      const idempotencyKey = this.buildIdempotencyKey({
        affiliateId: profile.user_id,
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
            affiliate_id: profile.user_id,
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

        // Write audit log entry for each new commission
        await this.prisma.medAllianceAuditLog.create({
          data: {
            entity_type: 'commission',
            entity_id: idempotencyKey, // temporary reference before we have the ID
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
        // P2002 = unique constraint violation — commission already exists, skip silently
        if (err?.code === 'P2002') {
          skipped++;
          continue;
        }
        this.logger.error(
          `Failed to create commission for snapshot ${snapshot.id}: ${err?.message ?? err}`,
        );
        // Non-blocking: continue with remaining snapshots
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
