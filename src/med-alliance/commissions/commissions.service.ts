import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommissionStatus, USER } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ListCommissionsDto } from './dto/list-commissions.dto';
import {
  DecideCommissionDto,
  VoidCommissionDto,
  ReinstateCommissionDto,
  UpdateBaseAmountDto,
} from './dto/decide-commission.dto';
import { AFFILIATE_VISIBLE_STATUSES } from '../../common/constant/commissions';
import { buildCommissionIdempotencyKey } from '../../common/utils/commission-idempotency';

// Terminal statuses — transitions out of these are not allowed.
const TERMINAL_STATUSES = ['paid', 'void', 'rejected'];

// Statuses eligible for an admin eligibility decision.
// 'detected' is excluded: commissions must reach 'pending_admin_confirmation' via the 30-day cron before admins can decide.
const DECIDABLE_STATUSES = ['pending_admin_confirmation'];

const COMMISSION_SELECT = {
  id: true,
  affiliate_id: true,
  affiliate_profile_id: true,
  organization_id: true,
  hubspot_invoice_snapshot_id: true,
  commission_percent_snapshot: true,
  base_amount_snapshot: true,
  commission_amount: true,
  status: true,
  idempotency_key: false, // never expose the idempotency key
  admin_decision_by: true,
  admin_decision_reason: true,
  admin_decision_at: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { id: true, name: true } },
  hubspotInvoiceSnapshot: {
    select: {
      id: true,
      hubspot_id: true,
      invoice_status: true,
      invoice_amount: true,
      currency: true,
      paid_at: true,
      hubspot_pdf_link: true,
      lineItems: {
        select: {
          id: true,
          name: true,
          description: true,
          quantity: true,
          amount: true,
          discount: true,
        },
      },
    },
  },
};

// Payout linkage — included in admin responses to trace which payout request
// paid a given commission.
const PAYOUT_LINKAGE_SELECT = {
  payoutRequestCommissions: {
    select: {
      payoutRequest: {
        select: {
          id: true,
          status: true,
          requested_amount: true,
          approved_amount: true,
          payment_method: true,
          payment_reference: true,
          paid_at: true,
          createdAt: true,
        },
      },
    },
  },
};

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Shared: write an audit log entry for a commission transition.
  // ---------------------------------------------------------------------------
  private async writeAuditLog(params: {
    actorUserId: string | null;
    entityId: string;
    event: string;
    oldStatus: string | null;
    newStatus: string | null;
    reason?: string;
    source: 'user' | 'sync' | 'admin_action';
    metadata?: object;
  }) {
    await this.prisma.medAllianceAuditLog.create({
      data: {
        actor_user_id: params.actorUserId,
        entity_type: 'commission',
        entity_id: params.entityId,
        event: params.event,
        old_status: params.oldStatus,
        new_status: params.newStatus,
        reason: params.reason ?? null,
        source: params.source,
        metadata: params.metadata ? (params.metadata as any) : undefined,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Affiliate: list own commissions.
  // ---------------------------------------------------------------------------
  async findAllForAffiliate(dto: ListCommissionsDto, currentUser: USER) {
    const {
      page = 1,
      limit = 20,
      status,
      created_from,
      created_to,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = dto;
    const skip = (page - 1) * limit;

    const where: any = { affiliate_id: currentUser.id };
    if (status && AFFILIATE_VISIBLE_STATUSES.includes(status)) {
      where.status = status;
    } else {
      where.status = { in: AFFILIATE_VISIBLE_STATUSES };
    }
    if (created_from || created_to) {
      where.createdAt = {};
      if (created_from) where.createdAt.gte = new Date(created_from);
      if (created_to) where.createdAt.lte = new Date(created_to);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.affiliateCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: COMMISSION_SELECT,
      }),
      this.prisma.affiliateCommission.count({ where }),
    ]);

    return { data, pagination: { page, limit, total } };
  }

  // ---------------------------------------------------------------------------
  // Affiliate: get one commission — scoped to the requesting affiliate.
  // ---------------------------------------------------------------------------
  async findOneForAffiliate(id: string, currentUser: USER) {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id },
      select: { ...COMMISSION_SELECT, affiliate_id: true },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.affiliate_id !== currentUser.id) {
      throw new ForbiddenException('You do not have access to this commission');
    }
    return commission;
  }

  // ---------------------------------------------------------------------------
  // Admin: list all commissions with full filter support.
  // ---------------------------------------------------------------------------
  async findAllForAdmin(dto: ListCommissionsDto) {
    const {
      page = 1,
      limit = 20,
      status,
      organization_id,
      affiliate_id,
      created_from,
      created_to,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (organization_id) where.organization_id = organization_id;
    if (affiliate_id) where.affiliate_id = affiliate_id;
    if (created_from || created_to) {
      where.createdAt = {};
      if (created_from) where.createdAt.gte = new Date(created_from);
      if (created_to) where.createdAt.lte = new Date(created_to);
    }

    const adminSelect = {
      ...COMMISSION_SELECT,
      ...PAYOUT_LINKAGE_SELECT,
      affiliate: {
        select: { id: true, first_name: true, last_name: true, email: true },
      },
      adminDecisionBy: {
        select: { id: true, first_name: true, last_name: true },
      },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.affiliateCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: adminSelect,
      }),
      this.prisma.affiliateCommission.count({ where }),
    ]);

    return { data, pagination: { page, limit, total } };
  }

  // ---------------------------------------------------------------------------
  // Admin: get one commission — no scoping.
  // ---------------------------------------------------------------------------
  async findOneForAdmin(id: string) {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id },
      select: {
        ...COMMISSION_SELECT,
        ...PAYOUT_LINKAGE_SELECT,
        affiliate: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        adminDecisionBy: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    return commission;
  }

  // ---------------------------------------------------------------------------
  // Admin: approve or reject a commission.
  // ---------------------------------------------------------------------------
  async decide(id: string, dto: DecideCommissionDto, adminUser: USER) {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id },
      select: { id: true, status: true, organization_id: true },
    });
    if (!commission) throw new NotFoundException('Commission not found');

    if (!DECIDABLE_STATUSES.includes(commission.status)) {
      throw new BadRequestException(
        `Commission in status "${commission.status}" cannot be decided. Only ${DECIDABLE_STATUSES.join(', ')} are allowed.`,
      );
    }

    // MA-004 guard: block approval if the referred organization was matched as an active client.
    // An admin can still reject, but cannot approve a commission from an ineligible referral.
    if (dto.decision === 'eligible' && commission.organization_id) {
      const org = await this.prisma.organization.findUnique({
        where: { id: commission.organization_id },
        select: { med_alliance_referral_status: true },
      });
      if (org?.med_alliance_referral_status === 'not_eligible') {
        throw new BadRequestException(
          'Cannot approve commission: referred organization is not eligible for the Med Alliance program.',
        );
      }
    }

    const newStatus = dto.decision === 'eligible' ? 'eligible' : 'rejected';

    const updated = await this.prisma.affiliateCommission.update({
      where: { id },
      data: {
        status: newStatus,
        admin_decision_by: adminUser.id,
        admin_decision_reason: dto.reason ?? null,
        admin_decision_at: new Date(),
      },
      select: COMMISSION_SELECT,
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'admin_decision',
      oldStatus: commission.status,
      newStatus,
      reason: dto.reason,
      source: 'admin_action',
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Admin: void a commission from any non-terminal status.
  // ---------------------------------------------------------------------------
  async void(id: string, dto: VoidCommissionDto, adminUser: USER) {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!commission) throw new NotFoundException('Commission not found');

    if (TERMINAL_STATUSES.includes(commission.status)) {
      throw new BadRequestException(
        `Commission is already in a terminal status: "${commission.status}". Cannot void.`,
      );
    }

    const updated = await this.prisma.affiliateCommission.update({
      where: { id },
      data: {
        status: 'void',
        admin_decision_by: adminUser.id,
        admin_decision_reason: dto.reason,
        admin_decision_at: new Date(),
      },
      select: COMMISSION_SELECT,
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'status_changed',
      oldStatus: commission.status,
      newStatus: 'void',
      reason: dto.reason,
      source: 'admin_action',
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Admin: revert an eligible commission back to pending_admin_confirmation.
  // ---------------------------------------------------------------------------
  async revertToPending(id: string, adminUser: USER) {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!commission) throw new NotFoundException('Commission not found');

    if (commission.status !== 'eligible') {
      throw new BadRequestException(
        `Only commissions in "eligible" status can be reverted to pending. Current status: "${commission.status}".`,
      );
    }

    const updated = await this.prisma.affiliateCommission.update({
      where: { id },
      data: {
        status: 'pending_admin_confirmation',
        admin_decision_by: null,
        admin_decision_reason: null,
        admin_decision_at: null,
      },
      select: COMMISSION_SELECT,
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'admin_reverted_to_pending',
      oldStatus: 'eligible',
      newStatus: 'pending_admin_confirmation',
      source: 'admin_action',
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Admin: unvoid a voided commission back to detected or pending_admin_confirmation.
  // Restores to pending_admin_confirmation if the company is already eligible (30-day gate passed),
  // otherwise restores to detected so the commission waits for the cron promotion.
  // ---------------------------------------------------------------------------
  async unvoid(id: string, dto: { reason: string }, adminUser: USER) {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        organization: { select: { med_alliance_referral_status: true } },
      },
    });
    if (!commission) throw new NotFoundException('Commission not found');

    if (commission.status !== 'void') {
      throw new BadRequestException(
        `Only commissions in "void" status can be unvoided. Current status: "${commission.status}".`,
      );
    }

    const targetStatus =
      commission.organization?.med_alliance_referral_status === 'eligible'
        ? 'pending_admin_confirmation'
        : 'detected';

    const updated = await this.prisma.affiliateCommission.update({
      where: { id },
      data: {
        status: targetStatus,
        admin_decision_by: adminUser.id,
        admin_decision_reason: dto.reason,
        admin_decision_at: new Date(),
      },
      select: COMMISSION_SELECT,
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'admin_unvoided',
      oldStatus: 'void',
      newStatus: targetStatus,
      reason: dto.reason,
      source: 'admin_action',
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Admin: reinstate a rejected commission back to eligible.
  // ---------------------------------------------------------------------------
  async reinstate(id: string, dto: ReinstateCommissionDto, adminUser: USER) {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!commission) throw new NotFoundException('Commission not found');

    if (commission.status !== 'rejected') {
      throw new BadRequestException(
        `Only commissions in "rejected" status can be reinstated. Current status: "${commission.status}".`,
      );
    }

    const updated = await this.prisma.affiliateCommission.update({
      where: { id },
      data: {
        status: 'eligible',
        admin_decision_by: adminUser.id,
        admin_decision_reason: dto.reason,
        admin_decision_at: new Date(),
      },
      select: COMMISSION_SELECT,
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'admin_reinstated',
      oldStatus: 'rejected',
      newStatus: 'eligible',
      reason: dto.reason,
      source: 'admin_action',
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Admin: update base_amount_snapshot on a detected commission.
  // ---------------------------------------------------------------------------
  async updateBaseAmount(
    id: string,
    dto: UpdateBaseAmountDto,
    adminUser: USER,
  ) {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        base_amount_snapshot: true,
        commission_percent_snapshot: true,
      },
    });
    if (!commission) throw new NotFoundException('Commission not found');

    if (
      !['detected', 'pending_admin_confirmation'].includes(commission.status)
    ) {
      throw new BadRequestException(
        `Base amount can only be updated on "detected" or "pending" commissions. Current: "${commission.status}".`,
      );
    }

    const baseAmount = parseFloat(dto.base_amount);
    if (isNaN(baseAmount) || baseAmount <= 0) {
      throw new BadRequestException('base_amount must be a positive number');
    }
    const pct = Number(commission.commission_percent_snapshot);
    const newCommissionAmount = ((baseAmount * pct) / 100).toFixed(2);

    const updated = await this.prisma.affiliateCommission.update({
      where: { id },
      data: {
        base_amount_snapshot: baseAmount.toString(),
        commission_amount: newCommissionAmount,
      },
      select: COMMISSION_SELECT,
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'admin_updated_base_amount',
      oldStatus: commission.status,
      newStatus: commission.status,
      source: 'admin_action',
      metadata: {
        old_base_amount: commission.base_amount_snapshot,
        new_base_amount: baseAmount.toString(),
        new_commission_amount: newCommissionAmount,
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Admin: manually create commissions from selected paid HubSpot invoices.
  // Applies the same business guards as CommissionDetectionService.run() but
  // always sets status to 'pending_admin_confirmation' since the admin is
  // explicitly initiating the creation (no 30-day hold needed).
  // ---------------------------------------------------------------------------
  async createFromInvoices(
    affiliateProfileId: string,
    invoiceIds: string[],
    adminUser: USER,
  ): Promise<{ created: number; skipped: number }> {
    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { id: affiliateProfileId },
      select: {
        id: true,
        user_id: true,
        status: true,
        commission_percent_default: true,
      },
    });
    if (!profile) throw new NotFoundException('Affiliate profile not found');
    if (profile.status !== 'active')
      throw new ForbiddenException('Affiliate profile is not active');
    if (!profile.user_id)
      throw new ForbiddenException('Affiliate has no connected user');

    let created = 0;
    let skipped = 0;

    for (const invoiceId of invoiceIds) {
      const snapshot = await this.prisma.hubspotInvoiceSnapshot.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          hubspot_id: true,
          organization_id: true,
          invoice_status: true,
          invoice_amount: true,
          payment_status: true,
          paid_at: true,
        },
      });

      if (!snapshot) {
        this.logger.warn(`Invoice snapshot ${invoiceId} not found — skipping`);
        skipped++;
        continue;
      }

      // Re-validate invoice eligibility.
      const isEligibleInvoice =
        snapshot.invoice_status === 'paid' &&
        new Decimal(snapshot.invoice_amount).gt(0) &&
        (snapshot.payment_status === null ||
          snapshot.payment_status === 'succeeded');

      if (!isEligibleInvoice) {
        this.logger.warn(
          `Invoice snapshot ${invoiceId} failed eligibility check — skipping`,
        );
        skipped++;
        continue;
      }

      // Load the related organization and apply business guards.
      const org = await this.prisma.organization.findUnique({
        where: { id: snapshot.organization_id },
        select: {
          id: true,
          referred_by_affiliate_id: true,
          med_alliance_block_reason: true,
          med_alliance_referral_status: true,
          eligibility_start_at: true,
          first_paid_invoice_at: true,
          referral_stage: true,
          createdAt: true,
        },
      });

      if (!org || org.referred_by_affiliate_id !== profile.user_id) {
        this.logger.warn(
          `Invoice ${invoiceId}: org not found or not referred by this affiliate — skipping`,
        );
        skipped++;
        continue;
      }

      if (org.med_alliance_block_reason?.startsWith('active_client_block')) {
        skipped++;
        continue;
      }

      if (
        org.med_alliance_referral_status === 'not_eligible' &&
        org.first_paid_invoice_at &&
        org.med_alliance_block_reason?.startsWith('eligibility_expired')
      ) {
        skipped++;
        continue;
      }

      if (
        org.med_alliance_referral_status === 'eligible' &&
        org.eligibility_start_at &&
        Date.now() - org.eligibility_start_at.getTime() > ONE_YEAR_MS
      ) {
        // Expire the eligibility window as a side-effect.
        await this.prisma.organization.update({
          where: { id: org.id },
          data: {
            med_alliance_referral_status: 'not_eligible',
            med_alliance_block_reason:
              'eligibility_expired: one-year window elapsed',
          },
        });
        skipped++;
        continue;
      }

      if (org.referral_stage === 'churned') {
        skipped++;
        continue;
      }

      // Transition to deployed on first paid invoice (idempotent).
      if (!org.first_paid_invoice_at && org.referral_stage !== 'deployed') {
        const firstInvoiceDate = snapshot.paid_at ?? new Date();
        const now = new Date();
        await this.prisma.organization.update({
          where: { id: org.id },
          data: {
            referral_stage: 'deployed',
            eligibility_start_at: now,
            first_paid_invoice_at: firstInvoiceDate,
            med_alliance_block_reason: null,
          },
        });
        await this.prisma.medAllianceAuditLog.create({
          data: {
            entity_type: 'referred_company',
            entity_id: org.id,
            event: 'stage_changed',
            old_status: 'not_eligible',
            new_status: 'not_eligible',
            reason:
              'First paid invoice — transitioned to deployed stage via manual commission creation',
            source: 'admin_action',
            actor_user_id: adminUser.id,
            metadata: {
              referral_stage: 'deployed',
              eligibility_start_at: now.toISOString(),
            } as any,
          },
        });
      }

      const idempotencyKey = buildCommissionIdempotencyKey({
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

        const commission = await this.prisma.affiliateCommission.create({
          data: {
            affiliate_id: profile.user_id,
            affiliate_profile_id: profile.id,
            organization_id: snapshot.organization_id,
            hubspot_invoice_snapshot_id: snapshot.id,
            commission_percent_snapshot: profile.commission_percent_default,
            base_amount_snapshot: snapshot.invoice_amount,
            commission_amount: commissionAmount,
            status: CommissionStatus.eligible,
            idempotency_key: idempotencyKey,
          },
          select: { id: true },
        });

        await this.writeAuditLog({
          actorUserId: adminUser.id,
          entityId: commission.id,
          event: 'manual_commission_created',
          oldStatus: null,
          newStatus: 'pending_admin_confirmation',
          source: 'admin_action',
          metadata: {
            organization_id: snapshot.organization_id,
            hubspot_invoice_id: snapshot.hubspot_id,
            created_by_admin: adminUser.id,
          },
        });

        created++;
      } catch (err: any) {
        if (err?.code === 'P2002') {
          skipped++;
          continue;
        }
        this.logger.error(
          `Failed to create commission for invoice ${invoiceId}: ${err?.message ?? err}`,
        );
        skipped++;
      }
    }

    this.logger.log(
      `Manual commission creation for affiliate ${affiliateProfileId}: created=${created} skipped=${skipped}`,
    );

    return { created, skipped };
  }

  // ---------------------------------------------------------------------------
  // Shared: get audit log timeline for a commission.
  // ---------------------------------------------------------------------------
  async getAuditLog(id: string) {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!commission) throw new NotFoundException('Commission not found');

    return this.prisma.medAllianceAuditLog.findMany({
      where: { entity_type: 'commission', entity_id: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        event: true,
        old_status: true,
        new_status: true,
        reason: true,
        source: true,
        metadata: true,
        createdAt: true,
        actorUser: { select: { id: true, first_name: true, last_name: true } },
      },
    });
  }
}
