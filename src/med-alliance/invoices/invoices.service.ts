import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { USER, HubspotInvoiceSnapshot } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ListInvoicesDto } from './dto/list-invoices.dto';

// Fields exposed to clients. raw_payload is intentionally excluded —
// it is an internal debug/replay field and must never be sent to the frontend.
const SNAPSHOT_SELECT = {
  id: true,
  hubspot_id: true,
  organization_id: true,
  invoice_status: true,
  payment_status: true,
  invoice_amount: true,
  currency: true,
  paid_at: true,
  sync_hash: true,
  createdAt: true,
  updatedAt: true,
  // raw_payload intentionally omitted
};

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // V1 candidate-input eligibility rule (MA-003 spec):
  //   1. invoice_status must be "paid"
  //   2. invoice_amount must be > 0
  //   3. If payment_status is present in the contract: must be "succeeded"
  //   4. If payment_status is null/absent: invoice_status alone is sufficient
  // ---------------------------------------------------------------------------
  private computeIsCandidateInput(
    snapshot: Pick<
      HubspotInvoiceSnapshot,
      'invoice_status' | 'payment_status' | 'invoice_amount'
    >,
  ): boolean {
    if (snapshot.invoice_status !== 'paid') return false;
    if (new Decimal(snapshot.invoice_amount).lte(0)) return false;
    if (
      snapshot.payment_status !== null &&
      snapshot.payment_status !== 'succeeded'
    ) {
      return false;
    }
    return true;
  }

  // Map a snapshot record to the response shape, appending the computed flag.
  private mapSnapshot(snapshot: any) {
    return {
      ...snapshot,
      is_candidate_input: this.computeIsCandidateInput(snapshot),
    };
  }

  // ---------------------------------------------------------------------------
  // Build the shared Prisma where clause from the DTO filters.
  // ---------------------------------------------------------------------------
  private buildWhere(organizationId: string, dto: ListInvoicesDto) {
    const where: any = { organization_id: organizationId };

    if (dto.invoice_status) where.invoice_status = dto.invoice_status;
    if (dto.payment_status) where.payment_status = dto.payment_status;

    if (dto.paid_at_from || dto.paid_at_to) {
      where.paid_at = {};
      if (dto.paid_at_from) where.paid_at.gte = new Date(dto.paid_at_from);
      if (dto.paid_at_to) where.paid_at.lte = new Date(dto.paid_at_to);
    }

    // When candidates_only=true, pre-filter at DB level for the most common case.
    // The remaining edge-case (payment_status check) is applied post-query.
    if (dto.candidates_only) {
      where.invoice_status = 'paid';
      where.invoice_amount = { gt: 0 };
    }

    return where;
  }

  // ---------------------------------------------------------------------------
  // Core query: fetch and paginate snapshots for a given organization.
  // Always ordered by paid_at DESC, createdAt DESC (MA-003 idempotency spec).
  // ---------------------------------------------------------------------------
  private async querySnapshots(organizationId: string, dto: ListInvoicesDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'paid_at',
      sortOrder = 'desc',
      candidates_only,
    } = dto;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(organizationId, dto);

    // Primary sort is always paid_at DESC to ensure sync retries reflect the
    // latest consistent state (hubspot_id is unique — one snapshot per invoice).
    const orderBy: any[] = [
      { [sortBy]: sortOrder },
      { createdAt: 'desc' },
    ];

    const [snapshots, total] = await this.prisma.$transaction([
      this.prisma.hubspotInvoiceSnapshot.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: SNAPSHOT_SELECT,
      }),
      this.prisma.hubspotInvoiceSnapshot.count({ where }),
    ]);

    let data = snapshots.map((s) => this.mapSnapshot(s));

    // Post-filter for candidates_only: remove records where payment_status
    // is present but not "succeeded" (cannot be done cleanly in Prisma where).
    if (candidates_only) {
      data = data.filter((s) => s.is_candidate_input);
    }

    return { data, pagination: { page, limit, total } };
  }

  // ---------------------------------------------------------------------------
  // Affiliate: get invoice snapshots for one of their referred companies.
  // Enforces that the organization was referred by the current user.
  // ---------------------------------------------------------------------------
  async getForAffiliate(
    organizationId: string,
    currentUser: USER,
    dto: ListInvoicesDto,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { referred_by_affiliate_id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    // Scoping guard: affiliate can only query their own referred companies.
    if (org.referred_by_affiliate_id !== currentUser.id) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    return this.querySnapshots(organizationId, dto);
  }

  // ---------------------------------------------------------------------------
  // Admin: get invoice snapshots for any organization — no affiliate scoping.
  // ---------------------------------------------------------------------------
  async getForAdmin(organizationId: string, dto: ListInvoicesDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    return this.querySnapshots(organizationId, dto);
  }

  // ---------------------------------------------------------------------------
  // Admin: list all snapshots across all organizations with global filters.
  // ---------------------------------------------------------------------------
  async listAllForAdmin(dto: ListInvoicesDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'paid_at',
      sortOrder = 'desc',
      candidates_only,
    } = dto;
    const skip = (page - 1) * limit;

    // Build where without organization_id filter.
    const where: any = {};
    if (dto.invoice_status) where.invoice_status = dto.invoice_status;
    if (dto.payment_status) where.payment_status = dto.payment_status;
    if (dto.paid_at_from || dto.paid_at_to) {
      where.paid_at = {};
      if (dto.paid_at_from) where.paid_at.gte = new Date(dto.paid_at_from);
      if (dto.paid_at_to) where.paid_at.lte = new Date(dto.paid_at_to);
    }
    if (candidates_only) {
      where.invoice_status = 'paid';
      where.invoice_amount = { gt: 0 };
    }

    const [snapshots, total] = await this.prisma.$transaction([
      this.prisma.hubspotInvoiceSnapshot.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortBy]: sortOrder }, { createdAt: 'desc' }],
        select: {
          ...SNAPSHOT_SELECT,
          // Admin global list also shows the organization name.
          organization: { select: { id: true, name: true } },
        },
      }),
      this.prisma.hubspotInvoiceSnapshot.count({ where }),
    ]);

    let data = snapshots.map((s) => this.mapSnapshot(s));
    if (candidates_only) {
      data = data.filter((s) => s.is_candidate_input);
    }

    return { data, pagination: { page, limit, total } };
  }
}
