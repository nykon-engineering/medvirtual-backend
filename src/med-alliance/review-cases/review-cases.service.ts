import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AdminReviewReasonCode, AdminReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListReviewCasesDto } from './dto/list-review-cases.dto';
import { ResolveReviewCaseDto } from './dto/resolve-review-case.dto';

const CASE_INCLUDE = {
  organization: {
    select: {
      id: true,
      name: true,
      email: true,
      hubspot_id: true,
      med_alliance_referral_status: true,
      hubspot_sync_status: true,
      referredByAffiliate: {
        select: { id: true, first_name: true, last_name: true, email: true },
      },
    },
  },
  resolvedBy: {
    select: { id: true, first_name: true, last_name: true, email: true },
  },
};

@Injectable()
export class ReviewCasesService {
  private readonly logger = new Logger(ReviewCasesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Opens a review case for the given org and reason.
   * Idempotent: if an open case for the same (org, reason) already exists,
   * the duplicate is silently ignored (catches Prisma P2002).
   */
  async openOrSkip(
    organizationId: string,
    reasonCode: AdminReviewReasonCode,
    metadata?: Record<string, any>,
  ): Promise<{ opened: boolean }> {
    try {
      await this.prisma.medAllianceAdminReviewCase.create({
        data: {
          organization_id: organizationId,
          reason_code: reasonCode,
          status: AdminReviewStatus.open,
          metadata: metadata ?? undefined,
        },
      });
      this.logger.log(
        `Opened review case: org=${organizationId} reason=${reasonCode}`,
      );
      return { opened: true };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // An open case already exists for this (org, reason) — skip silently
        return { opened: false };
      }
      throw err;
    }
  }

  async findAll(dto: ListReviewCasesDto) {
    const { page = 1, limit = 20, status, reason_code, search } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (reason_code) where.reason_code = reason_code;
    if (search) {
      where.organization = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.medAllianceAdminReviewCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: CASE_INCLUDE,
      }),
      this.prisma.medAllianceAdminReviewCase.count({ where }),
    ]);

    return { data, pagination: { page, limit, total } };
  }

  async findOne(id: string) {
    const item = await this.prisma.medAllianceAdminReviewCase.findUnique({
      where: { id },
      include: CASE_INCLUDE,
    });
    if (!item) throw new NotFoundException('Review case not found');
    return item;
  }

  /**
   * Resolves an open review case.
   *
   * Resolution side-effects by reason_code:
   * - multiple_hubspot_matches + hubspot_company_id: sets org.hubspot_id and resets sync state
   * - reconciliation_invoice_changed + action=void_and_recreate: voids the linked commission
   *   and clears snapshot.sync_hash so next sync re-evaluates the invoice
   * - all other cases: close only
   */
  async resolve(id: string, resolvedById: string, dto: ResolveReviewCaseDto) {
    const item = await this.findOne(id);

    if (item.status !== AdminReviewStatus.open) {
      throw new BadRequestException('Review case is already resolved');
    }

    // --- Side-effect: multiple HubSpot matches — admin assigns the correct company ---
    if (
      item.reason_code === AdminReviewReasonCode.multiple_hubspot_matches &&
      dto.hubspot_company_id
    ) {
      await this.prisma.organization.update({
        where: { id: item.organization_id },
        data: {
          hubspot_id: dto.hubspot_company_id,
          hubspot_sync_status: 'synced',
          hubspot_sync_error: null,
          hubspot_synced_at: new Date(),
          // Clear the needs_admin_review flag so commission detection can proceed
          med_alliance_referral_status: 'eligible',
        },
      });
      this.logger.log(
        `Admin set hubspot_id=${dto.hubspot_company_id} for org ${item.organization_id}`,
      );
    }

    // --- Side-effect: reconciliation — invoice changed after commission was detected ---
    if (
      item.reason_code === AdminReviewReasonCode.reconciliation_invoice_changed
    ) {
      if (dto.action === 'void_and_recreate') {
        await this.handleVoidAndRecreate(item);
      }
      // keep_existing: no side-effect, just close the case
    }

    return this.prisma.medAllianceAdminReviewCase.update({
      where: { id },
      data: {
        status: AdminReviewStatus.resolved,
        resolved_by_id: resolvedById,
        resolved_at: new Date(),
        resolution: dto.resolution,
      },
      include: CASE_INCLUDE,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Voids the commission linked to the changed invoice and clears the snapshot's
   * sync_hash so the next sync call re-evaluates the invoice and re-detects
   * the commission at the updated amount.
   *
   * Expected metadata shape: { commission_id, snapshot_id, hubspot_invoice_id }
   */
  private async handleVoidAndRecreate(item: {
    id: string;
    organization_id: string;
    metadata: any;
  }) {
    const meta = item.metadata as {
      commission_id?: string;
      snapshot_id?: string;
    } | null;

    if (meta?.commission_id) {
      await this.prisma.affiliateCommission.update({
        where: { id: meta.commission_id },
        data: { status: 'void' },
      });

      await this.prisma.medAllianceAuditLog.create({
        data: {
          entity_type: 'commission',
          entity_id: meta.commission_id,
          event: 'voided_by_reconciliation',
          old_status: 'eligible',
          new_status: 'void',
          source: 'admin_action',
          metadata: {
            review_case_id: item.id,
            organization_id: item.organization_id,
          },
        },
      });

      this.logger.log(
        `Voided commission ${meta.commission_id} via reconciliation review case ${item.id}`,
      );
    }

    if (meta?.snapshot_id) {
      // Clear sync_hash so InvoiceIngestionService re-processes this snapshot on next sync
      await this.prisma.hubspotInvoiceSnapshot.update({
        where: { id: meta.snapshot_id },
        data: { sync_hash: '' },
      });
    }
  }
}
