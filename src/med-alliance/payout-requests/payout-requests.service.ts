import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { USER } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { CreatePayoutRequestDto } from './dto/create-payout-request.dto';
import {
  DecidePayoutRequestDto,
  MarkPayoutPaidDto,
} from './dto/decide-payout-request.dto';
import { ListPayoutRequestsDto } from './dto/list-payout-requests.dto';

const PAYOUT_REQUEST_SELECT = {
  id: true,
  affiliate_id: true,
  affiliate_profile_id: true,
  status: true,
  requested_amount: true,
  approved_amount: true,
  payment_method: true,
  payment_reference: true,
  approved_by: true,
  approved_at: true,
  paid_at: true,
  rejection_reason: true,
  createdAt: true,
  updatedAt: true,
  commissions: {
    select: {
      commission: {
        select: {
          id: true,
          commission_amount: true,
          status: true,
          organization: { select: { id: true, name: true } },
        },
      },
    },
  },
};

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
  // All operations run inside a transaction to ensure consistency:
  //   1. Validate and lock commissions
  //   2. Create AffiliatePayoutRequest
  //   3. Create junction records (AffiliatePayoutRequestCommission)
  //   4. Update commission statuses to "requested"
  //   5. Write audit entries
  // ---------------------------------------------------------------------------
  async create(dto: CreatePayoutRequestDto, currentUser: USER) {
    const profile = await this.affiliatesService.requireActiveProfile(currentUser.id);

    // Validate all commission IDs before starting the transaction.
    const commissions = await this.prisma.affiliateCommission.findMany({
      where: { id: { in: dto.commission_ids } },
      select: {
        id: true,
        affiliate_id: true,
        status: true,
        commission_amount: true,
      },
    });

    // All requested IDs must exist.
    if (commissions.length !== dto.commission_ids.length) {
      throw new BadRequestException(
        'One or more commission IDs were not found',
      );
    }

    // Every commission must belong to this affiliate.
    const foreignCommission = commissions.find(
      (c) => c.affiliate_id !== currentUser.id,
    );
    if (foreignCommission) {
      throw new BadRequestException(
        'One or more commissions do not belong to your account',
      );
    }

    // Every commission must be in "eligible" status.
    const nonEligible = commissions.find((c) => c.status !== 'eligible');
    if (nonEligible) {
      throw new BadRequestException(
        `Commission ${nonEligible.id} is not eligible for payout (status: ${nonEligible.status})`,
      );
    }

    // Sum the requested amount.
    const requestedAmount = commissions.reduce(
      (acc, c) => acc.add(new Decimal(c.commission_amount)),
      new Decimal(0),
    );

    // Resolve payment method: DTO takes priority, then profile default.
    const paymentMethod =
      dto.payment_method ?? profile.payout_preference_method ?? null;

    // Execute all mutations in a single atomic transaction.
    const payoutRequest = await this.prisma.$transaction(async (tx) => {
      // Create the payout request.
      const request = await tx.affiliatePayoutRequest.create({
        data: {
          affiliate_id: currentUser.id,
          affiliate_profile_id: profile.id,
          status: 'requested',
          requested_amount: requestedAmount,
          payment_method: paymentMethod,
        },
      });

      // Create junction records linking each commission to this request.
      await tx.affiliatePayoutRequestCommission.createMany({
        data: dto.commission_ids.map((commissionId) => ({
          payout_request_id: request.id,
          commission_id: commissionId,
        })),
      });

      // Move all included commissions to "requested".
      await tx.affiliateCommission.updateMany({
        where: { id: { in: dto.commission_ids } },
        data: { status: 'requested' },
      });

      return request;
    });

    // Write audit entries outside the transaction (non-critical — do not roll back).
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

    // Return the fully loaded request.
    return this.prisma.affiliatePayoutRequest.findUnique({
      where: { id: payoutRequest.id },
      select: PAYOUT_REQUEST_SELECT,
    });
  }

  // ---------------------------------------------------------------------------
  // Affiliate: list own payout requests.
  // ---------------------------------------------------------------------------
  async findAllForAffiliate(dto: ListPayoutRequestsDto, currentUser: USER) {
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
    if (status) where.status = status;
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
  // Admin: list all payout requests with filters.
  // ---------------------------------------------------------------------------
  async findAllForAdmin(dto: ListPayoutRequestsDto) {
    const {
      page = 1,
      limit = 20,
      status,
      affiliate_id,
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

    const adminSelect = {
      ...PAYOUT_REQUEST_SELECT,
      affiliate: {
        select: { id: true, first_name: true, last_name: true, email: true },
      },
      approvedBy: {
        select: { id: true, first_name: true, last_name: true },
      },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.affiliatePayoutRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: adminSelect,
      }),
      this.prisma.affiliatePayoutRequest.count({ where }),
    ]);

    return { data, pagination: { page, limit, total } };
  }

  // ---------------------------------------------------------------------------
  // Admin: get one payout request with full details.
  // ---------------------------------------------------------------------------
  async findOneForAdmin(id: string) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: {
        ...PAYOUT_REQUEST_SELECT,
        affiliate: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        approvedBy: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    });
    if (!request) throw new NotFoundException('Payout request not found');
    return request;
  }

  // ---------------------------------------------------------------------------
  // Admin: approve or reject a payout request.
  // On rejection: commissions return to "eligible".
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

    if (request.status !== 'requested') {
      throw new BadRequestException(
        `Payout request is in status "${request.status}". Only "requested" requests can be decided.`,
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

      // On rejection: revert commission statuses back to "eligible".
      if (dto.decision === 'rejected') {
        await tx.affiliateCommission.updateMany({
          where: { id: { in: commissionIds } },
          data: { status: 'eligible' },
        });
      }
    });

    // Audit entries.
    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'admin_decision',
      oldStatus: 'requested',
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
            new_status: 'eligible',
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
  // Admin: mark a payout request as paid.
  // ---------------------------------------------------------------------------
  async markPaid(id: string, dto: MarkPayoutPaidDto, adminUser: USER) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        commissions: { select: { commission_id: true } },
      },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    if (request.status !== 'approved') {
      throw new BadRequestException(
        `Payout request must be "approved" before marking as paid (current: "${request.status}").`,
      );
    }

    const paidAt = dto.paid_at ? new Date(dto.paid_at) : new Date();
    const commissionIds = request.commissions.map((c) => c.commission_id);

    await this.prisma.$transaction(async (tx) => {
      await tx.affiliatePayoutRequest.update({
        where: { id },
        data: {
          status: 'paid',
          paid_at: paidAt,
          payment_reference: dto.payment_reference ?? null,
        },
      });

      // Move commissions to terminal "paid" status.
      await tx.affiliateCommission.updateMany({
        where: { id: { in: commissionIds } },
        data: { status: 'paid' },
      });
    });

    // Audit entries.
    await this.writeAuditLog({
      actorUserId: adminUser.id,
      entityId: id,
      event: 'status_changed',
      oldStatus: 'approved',
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
  // Admin: audit log timeline for a payout request.
  // ---------------------------------------------------------------------------
  async getAuditLog(id: string) {
    const request = await this.prisma.affiliatePayoutRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!request) throw new NotFoundException('Payout request not found');

    return this.prisma.medAllianceAuditLog.findMany({
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
  }
}
