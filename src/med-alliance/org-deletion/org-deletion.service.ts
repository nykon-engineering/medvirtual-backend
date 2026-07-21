import { Injectable, Logger } from '@nestjs/common';
import { AdminReviewReasonCode, CommissionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';
import { AllianceNotificationsService } from '../notifications/notifications.service';

// Statuses that can be safely auto-voided when the org disappears — money has
// not been requested by the affiliate yet, so no payout is in flight.
const AUTO_VOIDABLE_STATUSES: CommissionStatus[] = [
  'detected',
  'pending_admin_confirmation',
  'eligible',
];

@Injectable()
export class OrgDeletionService {
  private readonly logger = new Logger(OrgDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewCases: ReviewCasesService,
    private readonly allianceNotifications: AllianceNotificationsService,
  ) {}

  /**
   * Med Alliance side effects when an Organization is soft-deleted
   * (HubSpot company.deletion webhook or business_unit change).
   *
   * - Voids commissions not yet requested by the affiliate (reason: org_deleted).
   * - Requested commissions are NOT auto-voided: they already sit inside a payout
   *   request, so an admin must decide pay vs void — a review case is opened instead.
   * - Closes any other open review cases for the org (org no longer actionable).
   * - Writes an org-level audit log entry and notifies admins.
   *
   * No-op for organizations that were never referred by an affiliate.
   */
  async onOrganizationDeleted(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        referred_by_affiliate_id: true,
        referredByAffiliate: {
          select: { email: true, first_name: true, last_name: true },
        },
      },
    });

    if (!org?.referred_by_affiliate_id) return;

    const voidedCount = await this.voidNonRequestedCommissions(org.id);
    const pendingPayoutCount = await this.flagRequestedCommissions(org.id);
    await this.closeOtherOpenReviewCases(org.id);

    await this.prisma.medAllianceAuditLog.create({
      data: {
        entity_type: 'referred_company',
        entity_id: org.id,
        event: 'organization_deleted',
        old_status: null,
        new_status: null,
        reason: 'organization deleted in HubSpot',
        source: 'sync',
        actor_user_id: null,
        metadata: {
          commissions_voided: voidedCount,
          commissions_in_pending_payout: pendingPayoutCount,
        } as any,
      },
    });

    const affiliateName = org.referredByAffiliate
      ? `${org.referredByAffiliate.first_name} ${org.referredByAffiliate.last_name}`.trim()
      : 'Unknown affiliate';

    try {
      await this.allianceNotifications.notifyAdminReferredOrgDeleted({
        organizationName: org.name,
        affiliateName,
        commissionsVoided: voidedCount,
        commissionsInPendingPayout: pendingPayoutCount,
      });
    } catch (err) {
      this.logger.error(
        `Failed to notify admins about deleted referred org ${org.id}`,
        err,
      );
    }

    this.logger.log(
      `Med Alliance deletion hook completed for org ${org.id} — ` +
        `voided=${voidedCount} pending_payout=${pendingPayoutCount}`,
    );
  }

  /**
   * Med Alliance side effects when a previously deleted Organization is restored
   * (HubSpot company.restore webhook).
   *
   * - Writes an org-level audit log entry and notifies admins so they can review
   *   the restored org — including commissions that were voided on deletion,
   *   which are unvoided manually through the admin flow, not automatically here.
   *
   * No-op for organizations that were never referred by an affiliate.
   */
  async onOrganizationRestored(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        referred_by_affiliate_id: true,
        referredByAffiliate: {
          select: { email: true, first_name: true, last_name: true },
        },
      },
    });

    if (!org?.referred_by_affiliate_id) return;

    await this.prisma.medAllianceAuditLog.create({
      data: {
        entity_type: 'referred_company',
        entity_id: org.id,
        event: 'organization_restored',
        old_status: null,
        new_status: null,
        reason: 'organization restored in HubSpot',
        source: 'sync',
        actor_user_id: null,
      },
    });

    const affiliateName = org.referredByAffiliate
      ? `${org.referredByAffiliate.first_name} ${org.referredByAffiliate.last_name}`.trim()
      : 'Unknown affiliate';

    try {
      await this.allianceNotifications.notifyAdminReferredOrgRestored({
        organizationName: org.name,
        affiliateName,
      });
    } catch (err) {
      this.logger.error(
        `Failed to notify admins about restored referred org ${org.id}`,
        err,
      );
    }

    this.logger.log(`Med Alliance restore hook completed for org ${org.id}`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async voidNonRequestedCommissions(
    organizationId: string,
  ): Promise<number> {
    const commissions = await this.prisma.affiliateCommission.findMany({
      where: {
        organization_id: organizationId,
        status: { in: AUTO_VOIDABLE_STATUSES },
      },
      select: { id: true, status: true },
    });

    if (commissions.length === 0) return 0;

    await this.prisma.affiliateCommission.updateMany({
      where: { id: { in: commissions.map((c) => c.id) } },
      data: { status: 'void' },
    });

    await this.prisma.medAllianceAuditLog.createMany({
      data: commissions.map((c) => ({
        entity_type: 'commission' as const,
        entity_id: c.id,
        event: 'voided_org_deleted',
        old_status: c.status,
        new_status: 'void',
        // The org_deleted reason tag identifies these commissions as restorable
        // via the manual unvoid flow if the org is later reactivated in HubSpot.
        reason: 'org_deleted',
        source: 'sync' as const,
        actor_user_id: null,
        metadata: { organization_id: organizationId } as any,
      })),
    });

    return commissions.length;
  }

  private async flagRequestedCommissions(
    organizationId: string,
  ): Promise<number> {
    const requested = await this.prisma.affiliateCommission.findMany({
      where: { organization_id: organizationId, status: 'requested' },
      select: { id: true },
    });

    if (requested.length === 0) return 0;

    await this.reviewCases.openOrSkip(
      organizationId,
      AdminReviewReasonCode.org_deleted_with_pending_payout,
      { commission_ids: requested.map((c) => c.id) },
    );

    return requested.length;
  }

  private async closeOtherOpenReviewCases(
    organizationId: string,
  ): Promise<void> {
    await this.prisma.medAllianceAdminReviewCase.updateMany({
      where: {
        organization_id: organizationId,
        status: 'open',
        reason_code: {
          not: AdminReviewReasonCode.org_deleted_with_pending_payout,
        },
      },
      data: {
        status: 'resolved',
        resolved_at: new Date(),
        resolution:
          'Auto-resolved: organization was deleted in HubSpot — case is no longer actionable',
      },
    });
  }
}
