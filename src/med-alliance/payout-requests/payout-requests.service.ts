import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { USER } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { AdminCreatePayoutRequestDto, CreatePayoutRequestDto } from './dto/create-payout-request.dto';
import {
  AddPayoutNoteDto,
  CancelPayoutRequestDto,
  DecidePayoutRequestDto,
  MarkPayoutPaidDto,
  UpdatePayoutNoteDto,
} from './dto/decide-payout-request.dto';
import { ListPayoutRequestsDto } from './dto/list-payout-requests.dto';

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const PAYOUT_REQUEST_SELECT = {
  id: true,
  affiliate_id: true,
  affiliate_profile_id: true,
  status: true,
  requested_amount: true,
  approved_amount: true,
  paid_amount: true,
  payment_method: true,
  payment_reference: true,
  transaction_reference: true,
  payment_proof_notes: true,
  approved_by: true,
  approved_at: true,
  reviewed_by: true,
  reviewed_at: true,
  paid_at: true,
  rejection_reason: true,
  cancellation_reason: true,
  cancelled_by: true,
  cancelled_at: true,
  createdAt: true,
  updatedAt: true,
  commissions: {
    select: {
      commission: {
        select: {
          id: true,
          commission_amount: true,
          base_amount_snapshot: true,
          commission_percent_snapshot: true,
          status: true,
          admin_decision_reason: true,
          organization: { select: { id: true, name: true } },
          hubspotInvoiceSnapshot: {
            select: {
              id: true,
              invoice_amount: true,
              invoice_status: true,
            },
          },
        },
      },
    },
  },
};

const ADMIN_SELECT = {
  ...PAYOUT_REQUEST_SELECT,
  affiliate: {
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
    },
  },
  affiliateProfile: {
    select: {
      id: true,
      payout_details: true,
      payout_preference_method: true,
      payout_preference_reference: true,
      payout_preference_notes: true,
      createdAt: true,
    },
  },
  approvedBy: {
    select: { id: true, first_name: true, last_name: true },
  },
  reviewedBy: {
    select: { id: true, first_name: true, last_name: true },
  },
};

// ---------------------------------------------------------------------------
// Risk flag helpers (B4)
// ---------------------------------------------------------------------------

const AGING_DAYS = 14;

function computeRiskFlags(
  request: {
    createdAt: Date;
    affiliateProfile?: { banking_complete: boolean } | null;
    affiliate_id: string;
  },
  allRequestedIds: Set<string>,
): { has_duplicate_risk: boolean; has_missing_banking: boolean; is_aging: boolean } {
  const ageMs = Date.now() - new Date(request.createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return {
    has_duplicate_risk: allRequestedIds.has(request.affiliate_id),
    has_missing_banking: !(request.affiliateProfile?.banking_complete ?? true),
    is_aging: ageDays > AGING_DAYS,
  };
}

// ---------------------------------------------------------------------------
// Shape the admin response, adding risk flags + normalised commission fields
// ---------------------------------------------------------------------------

function shapeAdminRequest(raw: any, allRequestedIds?: Set<string>) {
  const flags = computeRiskFlags(raw, allRequestedIds ?? new Set());
  return {
    ...raw,
    affiliate_name: raw.affiliate
      ? `${raw.affiliate.first_name} ${raw.affiliate.last_name}`.trim()
      : undefined,
    affiliate_email: raw.affiliate?.email ?? undefined,
    commissions: (raw.commissions ?? []).map((c: any) => ({
      id: c.commission.id,
      organization_id: c.commission.organization?.id ?? null,
      organization_name: c.commission.organization?.name ?? null,
      base_amount: parseFloat(c.commission.base_amount_snapshot ?? '0'),
      commission_percentage: parseFloat(c.commission.commission_percent_snapshot ?? '0'),
      commission_amount: parseFloat(c.commission.commission_amount ?? '0'),
      decision: mapCommissionStatus(c.commission.status),
      rejection_reason: c.commission.admin_decision_reason ?? null,
      invoice_status: c.commission.hubspotInvoiceSnapshot?.invoice_status ?? null,
      invoice_amount: parseFloat(String(c.commission.hubspotInvoiceSnapshot?.invoice_amount ?? '0')),
      created_at: c.commission.createdAt ?? null,
    })),
    requested_amount: parseFloat(raw.requested_amount ?? '0'),
    approved_amount: raw.approved_amount ? parseFloat(raw.approved_amount) : null,
    paid_amount: raw.paid_amount ? parseFloat(raw.paid_amount) : null,
    requested_at: raw.createdAt,
    updated_at: raw.updatedAt,
    ...flags,
  };
}

function mapCommissionStatus(status: string): string {
  switch (status) {
    case 'paid':
      return 'approved_for_payout';
    case 'requested':
      return 'pending_review';
    case 'eligible':
      return 'pending_review';
    case 'rejected':
      return 'rejected_for_payout';
    default:
      return 'pending_review';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class PayoutRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly affiliatesService: AffiliatesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Shared audit log helper.
  // ---------------------------------------------------------------------------
  private async writeAuditLog(params: {
    actorUserId: string | null;
    entityId: string;
    event: string;
    oldStatus: string | null;
    newStatus: string | null;
    reason?: string;
    source: 'user' | 'sync' | 'admin_action';
  }) {
    await this.prisma.medAllianceAuditLog.create({
      data: {
        actor_user_id: params.actorUserId,
        entity_type: 'payout_request',
        entity_id: params.entityId,
        event: params.event,
        old_status: params.oldStatus,
        new_status: params.newStatus,
        reason: params.reason ?? null,
        source: params.source,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Affiliate: submit a new payout request.
  // ---------------------------------------------------------------------------
  async create(dto: CreatePayoutRequestDto, currentUser: USER) {
    const profile = await this.affiliatesService.requireActiveProfile(currentUser.id);

    const commissions = await this.prisma.affiliateCommission.findMany({
      where: { id: { in: dto.commission_ids } },
      select: {
        id: true,
        affiliate_id: true,
        status: true,
        commission_amount: true,
      },
    });

    if (commissions.length !== dto.commission_ids.length) {
      throw new BadRequestException('One or more commission IDs were not found');
    }

    const foreignCommission = commissions.find((c) => c.affiliate_id !== currentUser.id);
    if (foreignCommission) {
      throw new BadRequestException('One or more commissions do not belong to your account');
    }

    const nonEligible = commissions.find((c) => c.status !== 'eligible');
    if (nonEligible) {
      throw new BadRequestException(
        `Commission ${nonEligible.id} is not eligible for payout (status: ${nonEligible.status})`,
      );
    }

    const requestedAmount = commissions.reduce(
      (acc, c) => acc.add(new Decimal(c.commission_amount)),
      new Decimal(0),
    );

    const paymentMethod = dto.payment_method ?? profile.payout_preference_method ?? null;

    const payoutRequest = await this.prisma.$transaction(async (tx) => {
      const request = await tx.affiliatePayoutRequest.create({
        data: {
          affiliate_id: currentUser.id,
          affiliate_profile_id: profile.id,
          status: 'requested',
          requested_amount: requestedAmount,
          payment_method: paymentMethod,
        },
      });

      await tx.affiliatePayoutRequestCommission.createMany({
        data: dto.commission_ids.map((commissionId) => ({
          payout_request_id: request.id,
          commission_id: commissionId,
        })),
      });

      await tx.affiliateCommission.updateMany({
        where: { id: { in: dto.commission_ids } },
        data: { status: 'requested' },
      });

      return request;
    });

    await this.writeAuditLog({
      actorUserId: currentUser.id,
      entityId: payoutRequest.id,
      event: 'status_changed',
      oldStatus: null,
      newStatus: 'requested',
      source: 'user',
    });

    for (const commissionId of dto.commission_ids) {
      await this.prisma.medAllianceAuditLog.create({
        data: {
          actor_user_id: currentUser.id,
          entity_type: 'commission',
          entity_id: commissionId,
          event: 'status_changed',
          old_status: 'eligible',
          new_status: 'requested',
          source: 'user',
          metadata: { payout_request_id: payoutRequest.id } as any,
        },
      });
    }

    return this.prisma.affiliatePayoutRequest.findUnique({
      where: { id: payoutRequest.id },
      select: PAYOUT_REQUEST_SELECT,
    });
  }

  // ---------------------------------------------------------------------------
  // Admin: create a payout request on behalf of an affiliate.
  // ---------------------------------------------------------------------------
  async createForAdmin(dto: AdminCreatePayoutRequestDto, adminUser: USER) {
    // 1. Resolve affiliate profile
    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { id: dto.affiliate_profile_id },
      select: { id: true, user_id: true, payout_preference_method: true },
    });
    if (!profile) {
      throw new NotFoundException(
        `Affiliate profile not found: ${dto.affiliate_profile_id}`,
      );
    }

    // 2. Validate commissions exist, belong to that affiliate, and are eligible
    const commissions = await this.prisma.affiliateCommission.findMany({
      where: { id: { in: dto.commission_ids } },
      select: { id: true, affiliate_id: true, status: true, commission_amount: true },
    });

    if (commissions.length !== dto.commission_ids.length) {
      throw new BadRequestException('One or more commission IDs were not found');
    }

    const foreignCommission = commissions.find(
      (c) => c.affiliate_id !== profile.user_id,
    );
    if (foreignCommission) {
      throw new BadRequestException(
        'One or more commissions do not belong to this affiliate',
      );
    }

    const nonEligible = commissions.find((c) => c.status !== 'eligible');
    if (nonEligible) {
      throw new BadRequestException(
        `Commission ${nonEligible.id} is not eligible for payout (status: ${nonEligible.status})`,
      );
    }

    // 3. Sum amounts
    const requestedAmount = commissions.reduce(
      (acc, c) => acc.add(new Decimal(c.commission_amount)),
      new Decimal(0),
    );

    const paymentMethod = profile.payout_preference_method ?? null;

    // 4. Transactional create
    const payoutRequest = await this.prisma.$transaction(async (tx) => {
      const request = await tx.affiliatePayoutRequest.create({
        data: {
          affiliate_id: profile.user_id,
          affiliate_profile_id: profile.id,
          status: 'requested',
          requested_amount: requestedAmount,
          payment_method: paymentMethod,
        },
      });

      await tx.affiliatePayoutRequestCommission.createMany({
        data: dto.commission_ids.map((commissionId) => ({
          payout_request_id: request.id,
          commission_id: commissionId,
        })),
      });

      await tx.affiliateCommission.updateMany({
        where: { id: { in: dto.commission_ids } },
        data: { status: 'requested' },
      });

      return request;
    });

    // 5. Audit log — source is admin_action, actor is the admin
    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: payoutRequest.id,
      event: 'status_changed',
      oldStatus: null,
      newStatus: 'requested',
      reason: 'Admin-initiated payout request',
      source: 'admin_action',
    });

    for (const commissionId of dto.commission_ids) {
      await this.prisma.medAllianceAuditLog.create({
        data: {
          actor_user_id: adminUser.id,
          entity_type: 'commission',
          entity_id: commissionId,
          event: 'status_changed',
          old_status: 'eligible',
          new_status: 'requested',
          reason: 'Admin-initiated payout request',
          source: 'admin_action',
          metadata: { payout_request_id: payoutRequest.id } as any,
        },
      });
    }

    return this.findOneForAdmin(payoutRequest.id);
  }

  // ---------------------------------------------------------------------------
  // Affiliate: list own payout requests.
  // ---------------------------------------------------------------------------
  async findAllForAffiliate(dto: ListPayoutRequestsDto, currentUser: USER) {
    const {
      page = 1,
      limit = 20,
      status,
      payment_method,
      amount_min,
      amount_max,
      created_from,
      created_to,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = dto;
    const skip = (page - 1) * limit;

    const where: any = { affiliate_id: currentUser.id };
    if (status) where.status = status;
    if (payment_method) where.payment_method = payment_method;
    if (amount_min !== undefined || amount_max !== undefined) {
      where.requested_amount = {};
      if (amount_min !== undefined) where.requested_amount.gte = amount_min;
      if (amount_max !== undefined) where.requested_amount.lte = amount_max;
    }
    if (created_from || created_to) {
      where.createdAt = {};
      if (created_from) where.createdAt.gte = new Date(created_from);
      if (created_to) where.createdAt.lte = new Date(created_to);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.affiliatePayoutRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: PAYOUT_REQUEST_SELECT,
      }),
      this.prisma.affiliatePayoutRequest.count({ where }),
    ]);

    return { data, pagination: { page, limit, total } };
  }

  // ---------------------------------------------------------------------------
  // Affiliate: get one payout request — scoped.
  // ---------------------------------------------------------------------------
  async findOneForAffiliate(id: string, currentUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: { ...PAYOUT_REQUEST_SELECT, affiliate_id: true },
    });
    if (!request) throw new NotFoundException('Payout request not found');
    if (request.affiliate_id !== currentUser.id) {
      throw new NotFoundException('Payout request not found');
    }
    return request;
  }

  // ---------------------------------------------------------------------------
  // Admin: list all payout requests with filters (B6).
  // ---------------------------------------------------------------------------
  async findAllForAdmin(dto: ListPayoutRequestsDto) {
    const {
      page = 1,
      limit = 20,
      status,
      affiliate_id,
      search,
      risk_flag,
      amount_min,
      amount_max,
      created_from,
      created_to,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (affiliate_id) where.affiliate_id = affiliate_id;
    if (created_from || created_to) {
      where.createdAt = {};
      if (created_from) where.createdAt.gte = new Date(created_from);
      if (created_to) where.createdAt.lte = new Date(created_to);
    }
    // B6: amount range filter
    if (amount_min !== undefined || amount_max !== undefined) {
      where.requested_amount = {};
      if (amount_min !== undefined) where.requested_amount.gte = new Decimal(amount_min);
      if (amount_max !== undefined) where.requested_amount.lte = new Decimal(amount_max);
    }
    // B6: full-text search on affiliate name / email
    if (search) {
      where.affiliate = {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.affiliatePayoutRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: ADMIN_SELECT,
      }),
      this.prisma.affiliatePayoutRequest.count({ where }),
    ]);

    // B4: build set of affiliate_ids with multiple active requested requests (duplicate risk)
    const affiliateIds = rows.map((r: any) => r.affiliate_id);
    const duplicateSet = new Set(
      affiliateIds.filter((id: string, i: number) => affiliateIds.indexOf(id) !== i),
    );

    let data = rows.map((r: any) => shapeAdminRequest(r, duplicateSet));

    // B6: post-filter risk_flag (computed field — can't filter in SQL)
    if (risk_flag === 'duplicate') data = data.filter((r: any) => r.has_duplicate_risk);
    if (risk_flag === 'missing_banking') data = data.filter((r: any) => r.has_missing_banking);
    if (risk_flag === 'aging') data = data.filter((r: any) => r.is_aging);

    return { data, pagination: { page, limit, total: risk_flag ? data.length : total } };
  }

  // ---------------------------------------------------------------------------
  // Admin: get one payout request with full details.
  // ---------------------------------------------------------------------------
  async findOneForAdmin(id: string) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: ADMIN_SELECT,
    });
    if (!request) throw new NotFoundException('Payout request not found');
    return shapeAdminRequest(request);
  }

  // ---------------------------------------------------------------------------
  // B1: Admin: move a payout request from "requested" to "under_review".
  // ---------------------------------------------------------------------------
  async startReview(id: string, adminUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    if (request.status !== 'requested') {
      throw new BadRequestException(
        `Payout request is in status "${request.status}". Only "requested" requests can be moved to under review.`,
      );
    }

    await this.prisma.affiliatePayoutRequest.update({
      where: { id },
      data: {
        status: 'under_review',
        reviewed_by: adminUser.id,
        reviewed_at: new Date(),
      },
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'status_changed',
      oldStatus: 'requested',
      newStatus: 'under_review',
      source: 'admin_action',
    });

    return this.findOneForAdmin(id);
  }

  // ---------------------------------------------------------------------------
  // Admin: approve or reject a payout request.
  // Allowed from: "requested" or "under_review".
  // ---------------------------------------------------------------------------
  async decide(id: string, dto: DecidePayoutRequestDto, adminUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        requested_amount: true,
        commissions: { select: { commission_id: true } },
      },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    const decidableStatuses = ['requested', 'under_review'];
    if (!decidableStatuses.includes(request.status)) {
      throw new BadRequestException(
        `Payout request is in status "${request.status}". Only "requested" or "under_review" requests can be decided.`,
      );
    }

    const newStatus = dto.decision === 'approved' ? 'approved' : 'rejected';
    const commissionIds = request.commissions.map((c) => c.commission_id);

    await this.prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id },
        data: {
          status: newStatus,
          approved_amount:
            dto.decision === 'approved'
              ? dto.approved_amount ?? request.requested_amount
              : null,
          approved_by: adminUser.id,
          approved_at: new Date(),
          rejection_reason:
            dto.decision === 'rejected' ? dto.rejection_reason : null,
        },
      });

      if (dto.decision === 'rejected') {
        await tx.affiliateCommission.updateMany({
          where: { id: { in: commissionIds } },
          data: { status: 'rejected' },
        });
      }
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'admin_decision',
      oldStatus: request.status,
      newStatus,
      reason: dto.rejection_reason,
      source: 'admin_action',
    });

    if (dto.decision === 'rejected') {
      for (const commissionId of commissionIds) {
        await this.prisma.medAllianceAuditLog.create({
          data: {
            actor_user_id: adminUser.id,
            entity_type: 'commission',
            entity_id: commissionId,
            event: 'status_changed',
            old_status: 'requested',
            new_status: 'rejected',
            reason: 'Payout request rejected',
            source: 'admin_action',
            metadata: { payout_request_id: id } as any,
          },
        });
      }
    }

    return this.findOneForAdmin(id);
  }

  // ---------------------------------------------------------------------------
  // B2: Admin: mark a payout request as paid.
  // Allowed from: "under_review" or "approved" (legacy).
  // ---------------------------------------------------------------------------
  async markPaid(id: string, dto: MarkPayoutPaidDto, adminUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        approved_amount: true,
        requested_amount: true,
        commissions: { select: { commission_id: true } },
      },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    const payableStatuses = ['under_review', 'approved'];
    if (!payableStatuses.includes(request.status)) {
      throw new BadRequestException(
        `Payout request must be "under_review" or "approved" before marking as paid (current: "${request.status}").`,
      );
    }

    const paidAt = dto.paid_at ? new Date(dto.paid_at) : new Date();
    const paidAmount =
      dto.paid_amount ??
      parseFloat(String(request.approved_amount ?? request.requested_amount ?? 0));
    const txRef = dto.transaction_reference ?? dto.payment_reference ?? null;
    const commissionIds = request.commissions.map((c) => c.commission_id);

    await this.prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id },
        data: {
          status: 'paid',
          paid_at: paidAt,
          paid_amount: new Decimal(paidAmount),
          payment_reference: txRef,
          transaction_reference: txRef,
          payment_proof_notes: dto.payment_proof_notes ?? null,
          // Ensure approved fields are set if coming from under_review directly
          approved_by: request.status === 'under_review' ? adminUser.id : undefined,
          approved_at: request.status === 'under_review' ? new Date() : undefined,
        },
      });

      await tx.affiliateCommission.updateMany({
        where: { id: { in: commissionIds } },
        data: { status: 'paid' },
      });
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'status_changed',
      oldStatus: request.status,
      newStatus: 'paid',
      source: 'admin_action',
    });

    for (const commissionId of commissionIds) {
      await this.prisma.medAllianceAuditLog.create({
        data: {
          actor_user_id: adminUser.id,
          entity_type: 'commission',
          entity_id: commissionId,
          event: 'status_changed',
          old_status: 'requested',
          new_status: 'paid',
          source: 'admin_action',
          metadata: { payout_request_id: id } as any,
        },
      });
    }

    return this.findOneForAdmin(id);
  }

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Admin: cancel a payout request.
  // Allowed from: "requested" or "under_review".
  // Reverts linked commissions from "requested" → "eligible".
  // Idempotent: if already cancelled, returns the request without error.
  // ---------------------------------------------------------------------------
  async cancelPayoutRequest(id: string, dto: CancelPayoutRequestDto, adminUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        commissions: { select: { commission_id: true } },
      },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    if (request.status === 'cancelled') {
      return this.findOneForAdmin(id);
    }

    const cancellableStatuses = ['requested', 'under_review'];
    if (!cancellableStatuses.includes(request.status)) {
      throw new BadRequestException(
        `Payout request is in status "${request.status}". Only "requested" or "under_review" requests can be cancelled.`,
      );
    }

    const commissionIds = request.commissions.map((c) => c.commission_id);
    const oldStatus = request.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancellation_reason: dto.reason ?? null,
          cancelled_by: adminUser.id,
          cancelled_at: new Date(),
        },
      });

      if (commissionIds.length > 0) {
        await tx.affiliateCommission.updateMany({
          where: { id: { in: commissionIds } },
          data: { status: 'eligible' },
        });
      }
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'status_changed',
      oldStatus,
      newStatus: 'cancelled',
      reason: dto.reason,
      source: 'admin_action',
    });

    for (const commissionId of commissionIds) {
      await this.prisma.medAllianceAuditLog.create({
        data: {
          actor_user_id: adminUser.id,
          entity_type: 'commission',
          entity_id: commissionId,
          event: 'status_changed',
          old_status: 'requested',
          new_status: 'eligible',
          reason: 'Payout request cancelled',
          source: 'admin_action',
          metadata: { payout_request_id: id } as any,
        },
      });
    }

    return this.findOneForAdmin(id);
  }

  // ---------------------------------------------------------------------------
  // Admin: reopen a payout request to a previous status.
  // Transitions supported:
  //   under_review → requested
  //   rejected     → requested
  //   rejected     → under_review
  // When reopening from "rejected", linked commissions are reverted to "requested".
  // ---------------------------------------------------------------------------
  async reopen(id: string, targetStatus: 'requested' | 'under_review', adminUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        commissions: { select: { commission_id: true } },
      },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    const validSources: Record<'requested' | 'under_review', string[]> = {
      requested: ['under_review', 'rejected'],
      under_review: ['rejected'],
    };

    if (!validSources[targetStatus].includes(request.status)) {
      throw new BadRequestException(
        `Cannot reopen from "${request.status}" to "${targetStatus}".`,
      );
    }

    const oldStatus = request.status;
    const commissionIds = request.commissions.map((c) => c.commission_id);

    await this.prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = { status: targetStatus };

      if (oldStatus === 'under_review') {
        updateData.reviewed_by = null;
        updateData.reviewed_at = null;
      }

      if (oldStatus === 'rejected') {
        updateData.rejection_reason = null;
        if (commissionIds.length > 0) {
          await tx.affiliateCommission.updateMany({
            where: { id: { in: commissionIds } },
            data: { status: 'requested' },
          });
        }
      }

      await tx.affiliatePayoutRequest.update({
        where: { id },
        data: updateData,
      });
    });

    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'status_changed',
      oldStatus,
      newStatus: targetStatus,
      source: 'admin_action',
    });

    return this.findOneForAdmin(id);
  }

  // B3: Admin: add a note to a payout request.
  // ---------------------------------------------------------------------------
  async addNote(id: string, dto: AddPayoutNoteDto, adminUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    const note = await this.prisma.payoutRequestNote.create({
      data: {
        payout_request_id: id,
        author_user_id: adminUser.id,
        type: dto.type,
        content: dto.content,
      },
      select: {
        id: true,
        type: true,
        content: true,
        createdAt: true,
        author: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    });

    return {
      ...note,
      author: note.author
        ? `${note.author.first_name} ${note.author.last_name}`.trim()
        : 'Admin',
      created_at: note.createdAt,
    };
  }

  // ---------------------------------------------------------------------------
  // B3: Admin: list notes for a payout request.
  // ---------------------------------------------------------------------------
  async getNotes(id: string) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    const notes = await this.prisma.payoutRequestNote.findMany({
      where: { payout_request_id: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        content: true,
        createdAt: true,
        author: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    });

    return notes.map((n) => ({
      id: n.id,
      type: n.type,
      content: n.content,
      created_at: n.createdAt,
      author: n.author
        ? `${n.author.first_name} ${n.author.last_name}`.trim()
        : 'Admin',
    }));
  }

  // ---------------------------------------------------------------------------
  // B3: Affiliate: list notes for a payout request.
  // ---------------------------------------------------------------------------
  async getNotesForAffiliates(id: string) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    const notes = await this.prisma.payoutRequestNote.findMany({
      where: { payout_request_id: id, type: 'user' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        content: true,
        createdAt: true,
        author: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    });

    return notes.map((n) => ({
      id: n.id,
      type: n.type,
      content: n.content,
      created_at: n.createdAt,
      author: n.author
        ? `${n.author.first_name} ${n.author.last_name}`.trim()
        : 'Admin',
    }));
  }

  // ---------------------------------------------------------------------------
  // Admin: update the content of a payout request note.
  // ---------------------------------------------------------------------------
  async updateNote(payoutRequestId: string, noteId: string, dto: UpdatePayoutNoteDto) {
    const note = await this.prisma.payoutRequestNote.findFirst({
      where: { id: noteId, payout_request_id: payoutRequestId },
    });
    if (!note) throw new NotFoundException('Note not found');

    const updated = await this.prisma.payoutRequestNote.update({
      where: { id: noteId },
      data: { content: dto.content },
      select: {
        id: true,
        type: true,
        content: true,
        createdAt: true,
        author: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    });

    return {
      ...updated,
      author: updated.author
        ? `${updated.author.first_name} ${updated.author.last_name}`.trim()
        : 'Admin',
      created_at: updated.createdAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Admin: delete a payout request note.
  // ---------------------------------------------------------------------------
  async deleteNote(payoutRequestId: string, noteId: string) {
    const note = await this.prisma.payoutRequestNote.findFirst({
      where: { id: noteId, payout_request_id: payoutRequestId },
    });
    if (!note) throw new NotFoundException('Note not found');

    await this.prisma.payoutRequestNote.delete({ where: { id: noteId } });
  }

  // ---------------------------------------------------------------------------
  // Admin: audit log timeline for a payout request.
  // ---------------------------------------------------------------------------
  async getAuditLog(id: string) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    const entries = await this.prisma.medAllianceAuditLog.findMany({
      where: { entity_type: 'payout_request', entity_id: id },
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

    return entries.map((e) => ({
      id: e.id,
      action: e.event,
      actor: e.actorUser
        ? `${e.actorUser.first_name} ${e.actorUser.last_name}`.trim()
        : 'System',
      timestamp: e.createdAt,
      notes: e.reason ?? undefined,
      old_status: e.old_status,
      new_status: e.new_status,
    }));
  }

  // ---------------------------------------------------------------------------
  // B7: Admin: status counters for the kanban board header.
  // ---------------------------------------------------------------------------
  async getStatusCounts() {
    const counts = await this.prisma.affiliatePayoutRequest.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const result: Record<string, number> = {
      requested: 0,
      under_review: 0,
      approved: 0,
      paid: 0,
      rejected: 0,
      cancelled: 0,
    };

    for (const row of counts) {
      result[row.status] = row._count.id;
    }

    return result;
  }
}
