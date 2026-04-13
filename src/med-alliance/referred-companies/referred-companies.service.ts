import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationStatus, USER } from '@prisma/client';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { EligibilityCheckService } from './eligibility-check.service';
import { ReferralSyncService } from '../sync/referral-sync.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';
import { CreateOrganizationDto } from '../../organization/dto/createOrganization.dto';
import { CreateReferredCompanyDto } from './dto/create-referred-company.dto';
import { ListReferredCompaniesDto } from './dto/list-referred-companies.dto';
import { OrganizationService } from '../../organization/organization.service';
import { HubspotService } from '../../hubspot/hubspot.service';
import axios from 'axios';


@Injectable()
export class ReferredCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly affiliatesService: AffiliatesService,
    private readonly eligibilityCheck: EligibilityCheckService,
    private readonly referralSync: ReferralSyncService,
    private readonly reviewCases: ReviewCasesService,
    private readonly organizationService: OrganizationService,
    private readonly hubspot: HubspotService,
  ) {}


  async create(dto: CreateReferredCompanyDto | CreateOrganizationDto, currentUser: USER) {
    // Require an active affiliate profile before accepting the referral.
    await this.affiliatesService.requireActiveProfile(currentUser.id);


    //call the create origanization function to maintain the system reusable 
    const org =  await this.organizationService.create(dto, currentUser, currentUser.id);

    // MA-004: block if this company is already an active client.
    await this.eligibilityCheck.runAndPersist(org.id, currentUser.id, 'user');

    // MA-006: soft duplicate check — warn if another referred org with the same name or email exists.
    const softDuplicateWarning = await this.checkSoftDuplicate(org.id, dto as CreateReferredCompanyDto);

    // MA-005: run HubSpot matching + invoice ingestion + commission detection synchronously.
    await this.referralSync.run(org.id);

    // Return the org with all updated fields after the sync pipeline.
    const newOrganization = await this.prisma.organization.findUnique({
      where: { id: org.id },
      include: {
        owner: true,
        admin: true,
        users: true,
        referredByAffiliate: {
          select: {
            email: true,
            affiliateProfile:{
              select: {
                id: true,
                full_name: true,
                hubspot_id: true,
                commission_percent_default: true,
                payout_preference_method: true,
              }
            },
            organization: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              }

            },
          },
        },
        referToUser: {
          select: {
            id: true,
            hubspot_id: true,
            first_name: true,
            last_name: true,
          },
        },
      }
    });

    if (!newOrganization) throw new NotFoundException('Organization not found after creation');


    if (currentUser){ 
      try{
        // Here we need to work with flow asked by Hanieh
        // 1. Create an organization - this is done on organization service
        // 2. Create a contact with organization data and referral information from Affiliates
        // 3. Associate the contact with the organization in HubSpot
        // 4. Associate the contact with the affiliate in HubSpot
       
        await this.hubspot.createContactFromReferredCompanyInHubspot(newOrganization);   

      }catch(error){
        console.error('[hubspot] Error creating organization in HubSpot:', error);
      }
      

    }

    return softDuplicateWarning ? { ...newOrganization, warning: softDuplicateWarning } : newOrganization;
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
    where.status = status ?? { not: OrganizationStatus.deleted };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rawData, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        // Scoped DTO for affiliate — only referral-safe fields are returned.
        // See docs/specs/referred-company-data-access-policy.md for the full allowlist.
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          industry: true,
          business_unit: true,
          location: true,
          address: true,
          city: true,
          state: true,
          description: true,
          website_url: true,
          createdAt: true,
          contact_first_name: true,
          contact_last_name: true,
          med_alliance_referral_status: true,
          referToUser: {
            select: { id: true, first_name: true, last_name: true },
          },
          affiliateCommissions: {
            where: { affiliate_id: currentUser.id },
            select: { commission_amount: true, status: true },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    // Compute commission aggregate per org and strip the raw affiliateCommissions array.
    const data = rawData.map((org) => {
      const comms = org.affiliateCommissions ?? [];
      const my_commissions = comms
        .filter((c) => ['eligible', 'requested', 'paid'].includes(c.status))
        .reduce((sum: number, c) => sum + Number(c.commission_amount), 0);

      let commission_status: 'none' | 'pending' | 'eligible' | 'paid' = 'none';
      if (comms.some((c) => c.status === 'paid')) {
        commission_status = 'paid';
      } else if (comms.some((c) => c.status === 'eligible' || c.status === 'requested')) {
        commission_status = 'eligible';
      } else if (comms.some((c) => c.status === 'detected' || c.status === 'pending_admin_confirmation')) {
        commission_status = 'pending';
      }

      const { affiliateCommissions: _, ...rest } = org;
      return { ...rest, my_commissions, commission_status };
    });

    return { data, pagination: { page, limit, total } };
  }

  // ---------------------------------------------------------------------------
  // Affiliate: get one referred company — scoped to the requesting affiliate.
  // ---------------------------------------------------------------------------
  async findOneForAffiliate(id: string, currentUser: USER) {
    // First check existence and ownership with minimal query.
    const check = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, referred_by_affiliate_id: true },
    });
    if (!check) throw new NotFoundException('Referred company not found');

    // Prevent data leak: affiliate can only see their own referrals.
    if (check.referred_by_affiliate_id !== currentUser.id) {
      throw new ForbiddenException('You do not have access to this referred company');
    }

    // Return scoped DTO — only referral-safe fields.
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        industry: true,
        location: true,
        address: true,
        city: true,
        state: true,
        description: true,
        website_url: true,
        createdAt: true,
        contact_first_name: true,
        contact_last_name: true,
        med_alliance_referral_status: true,
      },
    });

    return org;
  }

  // ---------------------------------------------------------------------------
  // Admin: list all referred companies (no affiliate scoping).
  // ---------------------------------------------------------------------------
  async findAllForAdmin(dto: ListReferredCompaniesDto) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      affiliate_id,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = dto;
    const skip = (page - 1) * limit;

    // Admin sees only orgs that were referred (non-null referred_by_affiliate_id).
    const where: any = {
      referred_by_affiliate_id: { not: null },
    };
    where.status = status ?? { not: OrganizationStatus.deleted };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (affiliate_id) where.referred_by_affiliate_id = affiliate_id;

    const [rawData, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          business_unit: true,
          location: true,
          industry: true,
          website_url: true,
          contact_first_name: true,
          contact_last_name: true,
          med_alliance_referral_status: true,
          hubspot_sync_status: true,
          createdAt: true,
          referredByAffiliate: {
            select: { id: true, first_name: true, last_name: true, email: true },
          },
          referToUser: {
            select: { id: true, first_name: true, last_name: true },
          },
          affiliateCommissions: {
            select: { commission_amount: true, status: true },
          },
          _count: {
            select: {
              adminReviewCases: { where: { status: 'open' } },
            },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    // Aggregate commission totals and strip the raw array before returning.
    const data = rawData.map((org) => {
      const comms = org.affiliateCommissions ?? [];
      const total_paid = comms
        .filter((c) => c.status === 'paid')
        .reduce((sum: number, c) => sum + Number(c.commission_amount), 0);
      const total_pending = comms
        .filter((c) => ['eligible', 'requested'].includes(c.status))
        .reduce((sum: number, c) => sum + Number(c.commission_amount), 0);
      const has_open_review = (org._count?.adminReviewCases ?? 0) > 0;

      const { affiliateCommissions: _, _count: __, ...rest } = org;
      return { ...rest, total_paid, total_pending, has_open_review };
    });

    return { data, pagination: { page, limit, total } };
  }

  // ---------------------------------------------------------------------------
  // Admin: get one referred company — enriched with all Sheet data.
  // ---------------------------------------------------------------------------
  async findOneForAdmin(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        // Identity
        id: true,
        name: true,
        email: true,
        phone: true,
        business_unit: true,
        industry: true,
        location: true,
        address: true,
        city: true,
        state: true,
        website_url: true,
        description: true,
        contact_first_name: true,
        contact_last_name: true,
        // MA status
        med_alliance_referral_status: true,
        med_alliance_block_reason: true,
        hubspot_id: true,
        hubspot_sync_status: true,
        hubspot_sync_error: true,
        hubspot_synced_at: true,
        createdAt: true,
        // Who referred
        referredByAffiliate: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            affiliateProfile: {
              select: {
                full_name: true,
                commission_percent_default: true,
                payout_preference_method: true,
                status: true,
              },
            },
          },
        },
        // Assigned internal staff member
        referToUser: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        // Platform users (staff members) linked to this org
        users: {
          select: { id: true, first_name: true, last_name: true, email: true, role: true },
          orderBy: { first_name: 'asc' },
        },
        // Commission records for this org (all affiliates)
        affiliateCommissions: {
          select: {
            id: true,
            commission_amount: true,
            status: true,
            createdAt: true,
            hubspotInvoiceSnapshot: {
              select: { hubspot_id: true, invoice_amount: true, invoice_status: true, paid_at: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        // Raw HubSpot invoice snapshots
        hubspotInvoiceSnapshots: {
          select: {
            id: true,
            hubspot_id: true,
            invoice_amount: true,
            invoice_status: true,
            currency: true,
            paid_at: true,
          },
          orderBy: { paid_at: 'desc' },
        },
        // Admin review cases
        adminReviewCases: {
          select: {
            id: true,
            reason_code: true,
            status: true,
            metadata: true,
            resolution: true,
            createdAt: true,
            resolvedBy: { select: { first_name: true, last_name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!org) throw new NotFoundException('Referred company not found');
    return org;
  }

  // Get available referral options for the "referred_to" field when creating a referral (i.e. list of active users to whom the referral can be assigned).
  async getReferredToOptions(): Promise<any>{
    try {
      const url = "https://api.hubapi.com/crm/v3/properties/contacts";
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      });
  
      const vaTypeProperty = response.data.results.find(
        (prop) => prop.name === "referred_to"
      );
  
      if (!vaTypeProperty) {
        return [];
      }

      //console.log("VA Type Property:", vaTypeProperty);

      const availableOwners = await this.prisma.uSER.findMany({
        where: {
          hubspot_id: {
            in: vaTypeProperty.options.map((option) => option.value),
          },
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          hubspot_id: true,
        },
      });

      return availableOwners || [];
    } catch (error) {
      console.error("Failed to find Referred To options:", error.response?.data || error.message);
      throw new Error("Failed to find Referred To options");
    }
  }
}
