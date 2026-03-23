import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { USER } from '@prisma/client';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { EligibilityCheckService } from './eligibility-check.service';
import { ReferralSyncService } from '../sync/referral-sync.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';
import { CreateReferredCompanyDto } from './dto/create-referred-company.dto';
import { ListReferredCompaniesDto } from './dto/list-referred-companies.dto';

// Select shape returned for Organization in Med Alliance context.
// Excludes internal fields not relevant to the affiliate portal.
const ORG_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  website_url: true,
  location: true,
  industry: true,
  description: true,
  organization_role: true,
  status: true,
  hubspot_id: true,
  referred_by_affiliate_id: true,
  med_alliance_referral_status: true,
  med_alliance_block_reason: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class ReferredCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly affiliatesService: AffiliatesService,
    private readonly eligibilityCheck: EligibilityCheckService,
    private readonly referralSync: ReferralSyncService,
    private readonly reviewCases: ReviewCasesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Affiliate: submit a new company referral.
  // ---------------------------------------------------------------------------
  async create(dto: CreateReferredCompanyDto, currentUser: USER) {
    // Require an active affiliate profile before accepting the referral.
    await this.affiliatesService.requireActiveProfile(currentUser.id);

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        email: dto.email ?? null,
        website_url: dto.website_url ?? null,
        phone: dto.phone ?? null,
        location: dto.location ?? null,
        industry: dto.industry ?? null,
        description: dto.description ?? null,
        // Mark as referred by this affiliate.
        referred_by_affiliate_id: currentUser.id,
        // New referrals start as prospects.
        organization_role: 'prospect',
      },
      select: ORG_SELECT,
    });

    // MA-004: block if this company is already an active client.
    await this.eligibilityCheck.runAndPersist(org.id, currentUser.id, 'user');

    // MA-006: soft duplicate check — warn if another referred org with the same name or email exists.
    const softDuplicateWarning = await this.checkSoftDuplicate(org.id, dto);

    // MA-005: run HubSpot matching + invoice ingestion + commission detection synchronously.
    await this.referralSync.run(org.id);

    // Return the org with all updated fields after the sync pipeline.
    const result = await this.prisma.organization.findUnique({
      where: { id: org.id },
      select: {
        ...ORG_SELECT,
        med_alliance_referral_status: true,
        med_alliance_block_reason: true,
        hubspot_sync_status: true,
        hubspot_sync_error: true,
        hubspot_synced_at: true,
      },
    });

    return softDuplicateWarning ? { ...result, warning: softDuplicateWarning } : result;
  }

  /**
   * Checks if another referred organization with the same name or email already exists.
   * If a duplicate is found, opens a MA-006 review case and returns a warning message.
   * The referral is NOT blocked — this is advisory only.
   */
  private async checkSoftDuplicate(
    orgId: string,
    dto: CreateReferredCompanyDto,
  ): Promise<string | null> {
    const orConditions: any[] = [
      { name: { equals: dto.name, mode: 'insensitive' } },
    ];
    if (dto.email) {
      orConditions.push({ email: { equals: dto.email, mode: 'insensitive' } });
    }

    const duplicate = await this.prisma.organization.findFirst({
      where: {
        id: { not: orgId },
        referred_by_affiliate_id: { not: null },
        OR: orConditions,
      },
      select: { id: true, name: true },
    });

    if (!duplicate) return null;

    await this.reviewCases.openOrSkip(orgId, 'soft_duplicate_referral', {
      matched_organization_id: duplicate.id,
      matched_organization_name: duplicate.name,
    });

    return `This referral appears to be a duplicate of an existing referred company ("${duplicate.name}"). An admin review case has been opened.`;
  }

  // ---------------------------------------------------------------------------
  // Affiliate: list own referred companies.
  // ---------------------------------------------------------------------------
  async findAllForAffiliate(dto: ListReferredCompaniesDto, currentUser: USER) {
    const { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      referred_by_affiliate_id: currentUser.id,
    };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: ORG_SELECT,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { data, pagination: { page, limit, total } };
  }

  // ---------------------------------------------------------------------------
  // Affiliate: get one referred company — scoped to the requesting affiliate.
  // ---------------------------------------------------------------------------
  async findOneForAffiliate(id: string, currentUser: USER) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { ...ORG_SELECT, referred_by_affiliate_id: true },
    });
    if (!org) throw new NotFoundException('Referred company not found');

    // Prevent data leak: affiliate can only see their own referrals.
    if (org.referred_by_affiliate_id !== currentUser.id) {
      throw new ForbiddenException('You do not have access to this referred company');
    }

    return org;
  }

  // ---------------------------------------------------------------------------
  // Admin: list all referred companies (no affiliate scoping).
  // ---------------------------------------------------------------------------
  async findAllForAdmin(dto: ListReferredCompaniesDto) {
    const { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = dto;
    const skip = (page - 1) * limit;

    // Admin sees only orgs that were referred (non-null referred_by_affiliate_id).
    const where: any = {
      referred_by_affiliate_id: { not: null },
    };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          ...ORG_SELECT,
          // Admin also sees who referred the company.
          referredByAffiliate: {
            select: { id: true, first_name: true, last_name: true, email: true },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { data, pagination: { page, limit, total } };
  }

  // ---------------------------------------------------------------------------
  // Admin: get one referred company — no scoping.
  // ---------------------------------------------------------------------------
  async findOneForAdmin(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        ...ORG_SELECT,
        referredByAffiliate: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
    });
    if (!org) throw new NotFoundException('Referred company not found');
    return org;
  }
}
