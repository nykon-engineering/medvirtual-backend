import { Injectable } from '@nestjs/common';
import { MedAllianceAuditSource, MedAllianceEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  matchedOrganizationId?: string;
}

@Injectable()
export class EligibilityCheckService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks whether a referred organization is eligible for the Med Alliance
   * commission pipeline, i.e. it does NOT match an active MedVirtual client.
   *
   * Matching priority:
   *   1. hubspot_id exact match (most reliable)
   *   2. email exact match (fallback when hubspot_id is not yet set)
   *
   * The check is deterministic: the result changes only if hubspot_id, email,
   * or the matched organization's status changes.
   */
  async check(organizationId: string): Promise<EligibilityResult> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, hubspot_id: true, email: true },
    });

    if (!org) {
      return { eligible: true };
    }

    // --- Priority 1: match by hubspot_id ---
    if (org.hubspot_id) {
      const activeMatch = await this.prisma.organization.findFirst({
        where: {
          hubspot_id: org.hubspot_id,
          id: { not: organizationId },
          status: 'active',
        },
        select: { id: true },
      });

      if (activeMatch) {
        return {
          eligible: false,
          reason: 'active_client_block: organization_active_by_hubspot_id',
          matchedOrganizationId: activeMatch.id,
        };
      }
    }

    // --- Priority 2: match by email ---
    if (org.email) {
      const activeMatch = await this.prisma.organization.findFirst({
        where: {
          email: { equals: org.email, mode: 'insensitive' },
          id: { not: organizationId },
          referred_by_affiliate_id: null, // only match against real clients, not other referrals
          status: 'active',
        },
        select: { id: true },
      });

      if (activeMatch) {
        return {
          eligible: false,
          reason: 'active_client_block: organization_active_by_email',
          matchedOrganizationId: activeMatch.id,
        };
      }
    }

    return { eligible: true };
  }

  /**
   * Runs the eligibility check and persists the result on the organization.
   * Always writes to MedAllianceAuditLog regardless of the outcome.
   *
   * @param organizationId - The referred organization to evaluate
   * @param actorUserId    - The user who triggered the check (affiliate or admin)
   * @param source         - Audit log source ('user' | 'admin_action' | 'sync')
   * @returns The organization after update
   */
  async runAndPersist(
    organizationId: string,
    actorUserId: string,
    source: MedAllianceAuditSource,
  ) {
    const result = await this.check(organizationId);

    let newStatus: 'eligible' | 'not_eligible';
    let newBlockReason: string | null;

    if (!result.eligible) {
      newStatus = 'not_eligible';
      newBlockReason = result.reason ?? null;
    } else {
      newBlockReason = null;
      // Do not reset an already-active eligibility window (set by CommissionDetectionService
      // on first paid invoice). Only keep eligible if eligibility_start_at is still set.
      const current = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          med_alliance_referral_status: true,
          eligibility_start_at: true,
        },
      });
      const isActiveWindow =
        current?.med_alliance_referral_status === 'eligible' &&
        current?.eligibility_start_at != null;
      newStatus = isActiveWindow ? 'eligible' : 'not_eligible';
    }

    // Persist the eligibility result on the organization
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        med_alliance_referral_status: newStatus,
        med_alliance_block_reason: newBlockReason,
      },
    });

    // Write audit log entry (non-critical — outside transaction)
    await this.prisma.medAllianceAuditLog.create({
      data: {
        entity_type: MedAllianceEntityType.referred_company,
        entity_id: organizationId,
        event: 'eligibility_check',
        old_status: null,
        new_status: newStatus,
        reason: result.reason ?? null,
        source,
        actor_user_id: actorUserId,
        metadata: result.matchedOrganizationId
          ? { matched_organization_id: result.matchedOrganizationId }
          : undefined,
      },
    });

    return updated;
  }
}
