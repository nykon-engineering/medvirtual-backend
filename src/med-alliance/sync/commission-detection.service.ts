import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { buildCommissionIdempotencyKey } from '../../common/utils/commission-idempotency';
import { AllianceNotificationsService } from '../notifications/notifications.service';

// One year in milliseconds — the eligibility/expiry window, anchored on deployment_date.
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class CommissionDetectionService {
  private readonly logger = new Logger(CommissionDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly allianceNotifications: AllianceNotificationsService,
  ) {}

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
   *   1. Before deployment              → pending_confirmation (resting state), no automatic cutoff.
   *   2. First paid invoice received     → markDeployed (referral_stage = deployed) if not already
   *                                        deployed via the HubSpot deployment_date webhook.
   *                                        Confirm/Block become available to admins immediately.
   *   3. Admin confirms                  → eligible; new commissions created as 'pending_admin_confirmation'.
   *   4. More than 365 days since deployment_date → expire: set 'expired', skip commissions.
   *      This is enforced here as an inline backstop (in addition to the cron sweep in
   *      cron.service.ts#expireStaleEligibility) so a company stays correct even between cron runs.
   *   5. Active-client block             → skip permanently (block_reason prefix check, MA-004 — unrelated
   *                                        to eligibility status, never touched by this refactor).
   *   6. Canceled                        → skip commission creation entirely.
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
        name: true,
        status: true,
        referred_by_affiliate_id: true,
        med_alliance_referral_status: true,
        med_alliance_block_reason: true,
        eligibility_start_at: true,
        first_paid_invoice_at: true,
        referral_stage: true,
        deployment_date: true,
        createdAt: true,
      },
    });

    // Deleted organizations never generate commissions — the deletion hook already
    // voided the outstanding ones; re-detecting would resurrect them.
    if (org?.status === 'deleted') {
      this.logger.log(
        `Org ${organizationId} is deleted — skipping commission detection`,
      );
      return { created: 0, skipped: 0 };
    }

    if (!org?.first_paid_invoice_at) {
      await this.trackFirstPaidInvoice(organizationId);
    }

    if (!org?.referred_by_affiliate_id) {
      this.logger.warn(
        `Org ${organizationId} has no affiliate — skipping commission detection`,
      );
      return { created: 0, skipped: 0 };
    }

    // Permanent block: organization matched as an active MedVirtual client.
    if (org.med_alliance_block_reason?.startsWith('active_client_block')) {
      this.logger.log(
        `Org ${organizationId} has active-client block — skipping commission detection`,
      );
      return { created: 0, skipped: 0 };
    }

    const now = new Date();

    // Already expired — nothing further to do.
    if (org.med_alliance_referral_status === 'expired') {
      this.logger.log(
        `Org ${organizationId} eligibility already expired — skipping commission detection`,
      );
      return { created: 0, skipped: 0 };
    }

    // Inline expiry backstop: deployed more than 365 days ago and not yet marked expired.
    // Catches pending_confirmation, eligible, AND not_eligible (blocked) orgs — the cron sweep
    // (cron.service.ts#expireStaleEligibility) does the same, this just keeps things correct
    // between cron runs whenever this org is touched by the sync pipeline. Canceled orgs are
    // excluded — that stage is terminal and orthogonal to eligibility status (rule 8 / BR-13).
    if (
      org.referral_stage === 'deployed' &&
      org.deployment_date &&
      now.getTime() - org.deployment_date.getTime() > ONE_YEAR_MS
    ) {
      await this.expireEligibility(
        organizationId,
        org.med_alliance_referral_status,
      );
      return { created: 0, skipped: 0 };
    }

    // Load the affiliate's active profile to get the commission percentage.
    const profile = await this.prisma.affiliateProfile.findFirst({
      where: {
        user_id: org.referred_by_affiliate_id,
        status: { in: ['active', 'pending'] },
      },
      select: { id: true, user_id: true, commission_percent_default: true },
    });

    if (!profile) {
      this.logger.warn(
        `No active affiliate profile for user ${org.referred_by_affiliate_id} — skipping commission detection`,
      );
      return { created: 0, skipped: 0 };
    }
    if (!profile.user_id) {
      this.logger.warn(
        `Active affiliate profile ${profile.id} has no connected user — skipping commission detection`,
      );
      return { created: 0, skipped: 0 };
    }
    const affiliateUserId: string = profile.user_id;

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

    // First qualifying event: transition org to deployed stage (fallback path when no HubSpot
    // deployment_date webhook has fired yet). Skip if already deployed or canceled (idempotent).
    if (
      !org.first_paid_invoice_at &&
      !org.deployment_date &&
      org.referral_stage !== 'deployed' &&
      org.referral_stage !== 'canceled'
    ) {
      const firstInvoiceDate = candidates[0].paid_at ?? now;
      await this.markDeployed(organizationId, firstInvoiceDate);
      // Update local org state so downstream logic sees the new values.
      org.referral_stage = 'deployed';
      org.eligibility_start_at = firstInvoiceDate;
      org.first_paid_invoice_at = firstInvoiceDate;
    }

    // Canceled companies stop generating commissions.
    if (org.referral_stage === 'canceled') {
      this.logger.log(
        `Org ${organizationId} is canceled — skipping commission creation`,
      );
      return { created: 0, skipped: 0 };
    }

    // Determine commission status at creation time. New commissions go directly to
    // pending_admin_confirmation if the company is already confirmed eligible.
    const isEligibleNow = org.med_alliance_referral_status === 'eligible';

    const commissionStatus = isEligibleNow
      ? 'pending_admin_confirmation'
      : 'detected';

    // Fetch affiliate user once for notifications (only needed when commissions go to pending_admin_confirmation).
    let affiliateUser: { email: string; first_name: string | null } | null =
      null;
    if (isEligibleNow) {
      affiliateUser = await this.prisma.uSER.findUnique({
        where: { id: affiliateUserId },
        select: { email: true, first_name: true },
      });
    }

    // Create commissions for all candidate snapshots.
    let created = 0;
    let skipped = 0;

    for (const snapshot of candidates) {
      const idempotencyKey = buildCommissionIdempotencyKey({
        affiliateId: affiliateUserId,
        hubspotInvoiceId: snapshot.hubspot_id,
      });

      try {
        const commissionAmount = new Decimal(snapshot.invoice_amount)
          .mul(profile.commission_percent_default)
          .div(100)
          .toDecimalPlaces(2);

        const newCommission = await this.prisma.affiliateCommission.create({
          data: {
            affiliate_id: affiliateUserId,
            affiliate_profile_id: profile.id,
            organization_id: organizationId,
            hubspot_invoice_snapshot_id: snapshot.id,
            commission_percent_snapshot: profile.commission_percent_default,
            base_amount_snapshot: snapshot.invoice_amount,
            commission_amount: commissionAmount,
            status: commissionStatus,
            idempotency_key: idempotencyKey,
          },
        });

        await this.prisma.medAllianceAuditLog.create({
          data: {
            entity_type: 'commission',
            entity_id: idempotencyKey,
            event: isEligibleNow
              ? 'commission_pending_admin_confirmation'
              : 'commission_detected',
            old_status: null,
            new_status: commissionStatus,
            reason: null,
            source: 'sync',
            actor_user_id: null,
            metadata: {
              organization_id: organizationId,
              hubspot_invoice_id: snapshot.hubspot_id,
            } as any,
          },
        });

        if (isEligibleNow) {
          void this.allianceNotifications.notifyAdminCommissionPending({
            organizationName: org.name ?? organizationId,
            affiliateName: affiliateUser?.email ?? affiliateUserId,
            commissionAmount: parseFloat(String(commissionAmount)),
            commissionId: newCommission.id,
          });
        }

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

  private async trackFirstPaidInvoice(organizationId: string): Promise<void> {
    const earliest = await this.prisma.hubspotInvoiceSnapshot.findFirst({
      where: {
        organization_id: organizationId,
        invoice_status: 'paid',
        invoice_amount: { gt: 0 },
        OR: [{ payment_status: null }, { payment_status: 'succeeded' }],
      },
      orderBy: { paid_at: 'asc' },
      select: { paid_at: true },
    });

    if (!earliest?.paid_at) return;

    await this.prisma.organization.updateMany({
      where: { id: organizationId, first_paid_invoice_at: null },
      data: { first_paid_invoice_at: earliest.paid_at },
    });
  }

  /**
   * Transitions a referred organization to the 'deployed' pipeline stage on its first paid invoice.
   * Fallback path for when no HubSpot deployment_date webhook has fired yet. Sets eligibility_start_at
   * to the invoice date (no stabilization offset) and first_paid_invoice_at as a permanent audit field.
   * med_alliance_referral_status is left untouched — Confirm/Block become available to admins
   * immediately once deployed, there is no waiting period.
   */
  private async markDeployed(
    organizationId: string,
    firstInvoiceDate: Date,
  ): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        referral_stage: 'deployed',
        eligibility_start_at: firstInvoiceDate,
        first_paid_invoice_at: firstInvoiceDate,
        med_alliance_block_reason: null,
      },
    });

    await this.prisma.medAllianceAuditLog.create({
      data: {
        entity_type: 'referred_company',
        entity_id: organizationId,
        event: 'stage_changed',
        old_status: 'pending_confirmation',
        new_status: 'pending_confirmation',
        reason:
          'First paid invoice — auto-transitioned to deployed stage; eligibility decisions now available',
        source: 'sync',
        actor_user_id: null,
        metadata: {
          referral_stage: 'deployed',
          eligibility_start_at: firstInvoiceDate.toISOString(),
        } as any,
      },
    });

    this.logger.log(
      `Org ${organizationId} transitioned to deployed — eligibility_start_at=${firstInvoiceDate.toISOString()}`,
    );
  }

  /**
   * Expires eligibility when deployment_date is more than 365 days in the past.
   * Clears med_alliance_block_reason — expiry is now its own status, no reason-string encoding needed.
   */
  private async expireEligibility(
    organizationId: string,
    oldStatus: string | null,
  ): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        med_alliance_referral_status: 'expired',
        med_alliance_block_reason: null,
      },
    });

    await this.prisma.medAllianceAuditLog.create({
      data: {
        entity_type: 'referred_company',
        entity_id: organizationId,
        event: 'eligibility_expired',
        old_status: oldStatus,
        new_status: 'expired',
        reason: 'One-year window since deployment_date elapsed',
        source: 'sync',
        actor_user_id: null,
        metadata: undefined,
      },
    });

    this.logger.log(
      `Org ${organizationId} eligibility window expired — status set to expired`,
    );
  }
}
