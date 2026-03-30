import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { USER } from '@prisma/client';
import { ListCommissionsDto } from './dto/list-commissions.dto';
import { DecideCommissionDto, VoidCommissionDto } from './dto/decide-commission.dto';

// Terminal statuses — transitions out of these are not allowed.
const TERMINAL_STATUSES = ['paid', 'void', 'rejected'];

// Statuses eligible for an admin eligibility decision.
const DECIDABLE_STATUSES = ['detected', 'pending_admin_confirmation'];

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
      invoice_amount: true,
      currency: true,
      paid_at: true,
    },
  },
};

@Injectable()
export class CommissionsService {
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
    if (status) where.status = status;
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
      if (org?.med_alliance_referral_status === 'not_eligible_active_client') {
        throw new BadRequestException(
          'Cannot approve commission: referred organization is blocked as an active MedVirtual client.',
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
