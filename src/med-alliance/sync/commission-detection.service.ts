import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { buildCommissionIdempotencyKey } from '../../common/utils/commission-idempotency';
import { AllianceNotificationsService } from '../notifications/notifications.service';

// One year in milliseconds — used for the eligibility window and referral-age rule.
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// 30-day stabilization window: deployed companies must be deployed for this long before going eligible.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
   * Eligibility lifecycle (updated):
   *   1. Before first paid invoice       → not_eligible, no commissions created.
   *   2. First paid invoice received     → markDeployed (referral_stage = deployed,
   *                                        eligibility_start_at = now). Status stays not_eligible.
   *                                        Cron promotes to eligible after 30 days.
   *   3. Within 30-day stabilization     → not_eligible, commissions created as 'detected'.
   *   4. After 30 days, within one year  → eligible (set by cron), new commissions as 'pending_admin_confirmation'.
   *   5. One year after eligibility_start_at → expire: set not_eligible, skip commissions.
   *   6. Referral older than one year with no first paid invoice → skip (referral-age rule).
   *   7. Active-client block             → skip permanently (block_reason prefix check).
   *   8. Churned                         → skip commission creation entirely.
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

    // Eligibility window expiry: eligible but eligibility_start_at (first_paid_invoice_at + 30 days) is older than one year.
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
      this.logger.log(
        `Org ${organizationId} referred > 1 year ago with no paid invoice — skipping`,
      );
      return { created: 0, skipped: 0 };
    }

    // Window already expired in a prior run — block_reason signals expiry; first_paid_invoice_at is set.
    if (
      org.med_alliance_referral_status === 'not_eligible' &&
      org.first_paid_invoice_at &&
      org.med_alliance_block_reason?.startsWith('eligibility_expired')
    ) {
      this.logger.log(
        `Org ${organizationId} eligibility window expired — skipping commission detection`,
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

    // First qualifying event: transition org to deployed stage and start the 30-day clock.
    // Skip if already deployed or churned (idempotent).
    if (
      !org.first_paid_invoice_at &&
      !org.deployment_date &&
      org.referral_stage !== 'deployed' &&
      org.referral_stage !== 'churned'
    ) {
      const firstInvoiceDate = candidates[0].paid_at ?? now;
      await this.markDeployed(organizationId, firstInvoiceDate);
      // Update local org state so downstream logic sees the new values.
      org.referral_stage = 'deployed';
      org.eligibility_start_at = new Date(
        firstInvoiceDate.getTime() + THIRTY_DAYS_MS,
      );
      org.first_paid_invoice_at = firstInvoiceDate;
    }

    // Churned companies stop generating commissions.
    if (org.referral_stage === 'churned') {
      this.logger.log(
        `Org ${organizationId} is churned — skipping commission creation`,
      );
      return { created: 0, skipped: 0 };
    }

    // Determine commission status at creation time.
    // New commissions go directly to pending_admin_confirmation if the company is already eligible
    // (i.e. deployed > 30 days ago and within the one-year window).
    const isEligibleNow =
      org.med_alliance_referral_status === 'eligible' &&
      org.eligibility_start_at != null &&
      Date.now() >= org.eligibility_start_at.getTime() &&
      Date.now() - org.eligibility_start_at.getTime() <= ONE_YEAR_MS;

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
        paidAt: snapshot.paid_at,
        baseAmount: snapshot.invoice_amount.toString(),
        commissionPercent: profile.commission_percent_default.toString(),
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
   * Sets eligibility_start_at to NOW (deployment date — anchor for both 30-day and one-year windows)
   * and first_paid_invoice_at to the actual invoice date (permanent audit field).
   * med_alliance_referral_status stays 'not_eligible' — the cron promotes it to 'eligible' after 30 days.
   */
  private async markDeployed(
    organizationId: string,
    firstInvoiceDate: Date,
  ): Promise<void> {
    const eligibilityStartAt = new Date(
      firstInvoiceDate.getTime() + THIRTY_DAYS_MS,
    );
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        referral_stage: 'deployed',
        eligibility_start_at: eligibilityStartAt,
        first_paid_invoice_at: firstInvoiceDate,
        med_alliance_block_reason: null,
        // med_alliance_referral_status intentionally stays 'not_eligible'
      },
    });

    await this.prisma.medAllianceAuditLog.create({
      data: {
        entity_type: 'referred_company',
        entity_id: organizationId,
        event: 'stage_changed',
        old_status: 'not_eligible',
        new_status: 'not_eligible',
        reason:
          'First paid invoice — auto-transitioned to deployed stage; 30-day stabilization clock started',
        source: 'sync',
        actor_user_id: null,
        metadata: {
          referral_stage: 'deployed',
          eligibility_start_at: eligibilityStartAt.toISOString(),
        } as any,
      },
    });

    this.logger.log(
      `Org ${organizationId} transitioned to deployed — eligibility_start_at=${eligibilityStartAt.toISOString()}`,
    );
  }

  /**
   * Expires eligibility when the one-year window has passed.
   * Preserves eligibility_start_at as a permanent record of when the company was deployed.
   * Sets med_alliance_block_reason to signal expiry for downstream guards.
   */
  private async expireEligibility(organizationId: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        med_alliance_referral_status: 'not_eligible',
        // eligibility_start_at is preserved — it is the deployment date, not an eligibility anchor
        med_alliance_block_reason:
          'eligibility_expired: one-year window elapsed',
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

    this.logger.log(
      `Org ${organizationId} eligibility window expired — status set to not_eligible`,
    );
  }
}
