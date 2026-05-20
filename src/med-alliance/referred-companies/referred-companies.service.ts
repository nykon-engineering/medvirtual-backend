import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MedAllianceReferralStatus,
  OrganizationStatus,
  USER,
} from '@prisma/client';
import { UpdateReferralStageDto } from './dto/update-referral-stage.dto';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Returns the effective eligibility status for display.
 * Applies both the 30-day stabilization gate and the one-year window check
 * at read-time so the UI stays accurate without requiring a cron to have run.
 *
 * eligibilityStartAt is the deployment date — not the invoice date.
 */
function computeEffectiveStatus(
  stored: MedAllianceReferralStatus | null,
  eligibilityStartAt: Date | null,
): MedAllianceReferralStatus | null {
  if (stored !== 'eligible') return stored;
  if (!eligibilityStartAt) return 'not_eligible';
  const elapsed = Date.now() - eligibilityStartAt.getTime();
  if (elapsed < THIRTY_DAYS_MS) return 'not_eligible';
  if (elapsed > ONE_YEAR_MS) return 'not_eligible';
  return 'eligible';
}
import { AFFILIATE_VISIBLE_STATUSES } from '../../common/constant/commissions';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { EligibilityCheckService } from './eligibility-check.service';
import { ReferralSyncService } from '../sync/referral-sync.service';
import { ReviewCasesService } from '../review-cases/review-cases.service';
import { CreateOrganizationDto } from '../../organization/dto/createOrganization.dto';
import { CreateReferredCompanyDto } from './dto/create-referred-company.dto';
import { ListReferredCompaniesDto } from './dto/list-referred-companies.dto';
import { OrganizationService } from '../../organization/organization.service';
import { HubspotService } from '../../hubspot/hubspot.service';
import { ContactService } from '../../contacts/contacts.service';
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
    private readonly contactService: ContactService,
  ) {}

  async create(
    dto: CreateReferredCompanyDto | CreateOrganizationDto,
    currentUser: USER,
  ) {
    // Step 0: Validation — read-only, no rollback needed.
    const affiliateProfile = await this.affiliatesService.requireActiveProfile(currentUser.id);
    await this.verifyGrowthPartnerInHubspot(affiliateProfile.hubspot_id);

    const cleanupStack: Array<() => Promise<void>> = [];

    try {
      // Step 1: Create organization (DB + HubSpot company).
      const org = await this.organizationService.create(
        dto,
        currentUser,
        currentUser.id,
      );
      // Save pre-sync hubspot_id: referralSync (Step 4) may update org.hubspot_id to a matched
      // existing HubSpot company. We keep the original ID so the contact is associated with the
      // company that was just created for this referral, not the matched one.
      const preReferralSyncHubspotId = org.hubspot_id;
      cleanupStack.push(async () => {
        // Delete HubSpot company if it was created during org creation.
        const freshOrg = await this.prisma.organization.findUnique({
          where: { id: org.id },
          select: { hubspot_id: true },
        });
        if (freshOrg?.hubspot_id) {
          await this.hubspot
            .deleteCompanyInHubspot(freshOrg.hubspot_id, currentUser.id, org.id)
            .catch((e) =>
              console.error('[rollback] Failed to delete HubSpot company:', e),
            );
        }
        // Delete child records that do NOT cascade on org deletion.
        await this.prisma
          .$transaction([
            this.prisma.affiliateCommission.deleteMany({
              where: { organization_id: org.id },
            }),
            this.prisma.hubspotInvoiceSnapshot.deleteMany({
              where: { organization_id: org.id },
            }),
            this.prisma.medAllianceAdminReviewCase.deleteMany({
              where: { organization_id: org.id },
            }),
          ])
          .catch((e) =>
            console.error('[rollback] Failed to delete child records:', e),
          );

        // Delete audit logs (uses entity_id, not a FK).
        await this.prisma.medAllianceAuditLog
          .deleteMany({
            where: { entity_id: org.id },
          })
          .catch((e) =>
            console.error('[rollback] Failed to delete audit logs:', e),
          );

        // Finally delete the organization itself.
        await this.prisma.organization
          .delete({ where: { id: org.id } })
          .catch((e) =>
            console.error('[rollback] Failed to delete organization:', e),
          );
      });

      // Step 2: MA-004 — block if this company is already an active client.
      await this.eligibilityCheck.runAndPersist(org.id, currentUser.id, 'user');

      // Step 3: MA-006 — soft duplicate check.
      const softDuplicateWarning = await this.checkSoftDuplicate(
        org.id,
        dto as CreateReferredCompanyDto,
      );

      // Step 4: MA-005 — HubSpot matching + invoice ingestion + commission detection.
      await this.referralSync.run(org.id);

      // Step 5: Reload org with all updated fields after the sync pipeline.
      const newOrganization = await this.prisma.organization.findUnique({
        where: { id: org.id },
        include: {
          owner: true,
          admin: true,
          users: true,
          referredByAffiliate: {
            select: {
              email: true,
              affiliateProfile: {
                select: {
                  id: true,
                  full_name: true,
                  hubspot_id: true,
                  commission_percent_default: true,
                  payout_preference_method: true,
                },
              },
              organization: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
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
        },
      });

      if (!newOrganization)
        throw new NotFoundException('Organization not found after creation');

      // Step 6: Create Contact in DB + HubSpot with referral data + associations.
      if (currentUser) {
        try {
          const { contact: newContact, hubspotId: hubspotContactId } =
            await this.contactService.createForReferredCompany({
              ...newOrganization,
              hubspot_id:
                preReferralSyncHubspotId ?? newOrganization.hubspot_id,
            });
          if (newContact) {
            cleanupStack.push(async () => {
              await this.contactService
                .deleteById(newContact.id)
                .catch((e) =>
                  console.error('[rollback] Failed to delete DB contact:', e),
                );
            });
          }
          if (hubspotContactId && typeof hubspotContactId === 'string') {
            cleanupStack.push(async () => {
              await this.hubspot
                .deleteContactInHubspot(
                  { hubspot_contact_id: hubspotContactId },
                  currentUser.id,
                )
                .catch((e) =>
                  console.error(
                    '[rollback] Failed to delete HubSpot contact:',
                    e,
                  ),
                );
            });
          }
        } catch (hubspotError) {
          const errData = hubspotError?.response?.data || hubspotError;
          if (errData?.category === 'CONFLICT') {
            console.error(
              '[ReferredCompaniesService.create] HubSpot contact conflict, initiating rollback:',
              errData,
            );
            await this.executeRollback(cleanupStack);
            throw new BadRequestException(
              errData.message || 'Contact already exists in HubSpot',
            );
          }
          throw hubspotError;
        }
      }

      return softDuplicateWarning
        ? { ...newOrganization, warning: softDuplicateWarning }
        : newOrganization;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException(
          `The contact already exists with this email.`,
        );
      }
      console.error(
        '[ReferredCompaniesService.create] Error occurred, initiating rollback:',
        error,
      );
      await this.executeRollback(cleanupStack);
      throw new BadRequestException(
        `Failed to create referred company: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Executes the cleanup stack in reverse order (LIFO).
   * Each cleanup function has its own error handling so one failure does not block the rest.
   */
  private async verifyGrowthPartnerInHubspot(hubspotId: string | null): Promise<void> {
    if (!hubspotId) return;
    try {
      await axios.get(
        `https://api.hubapi.com/crm/v3/objects/p20630393_growth_partners/${hubspotId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          },
        },
      );
    } catch (error) {
      if (error?.response?.status === 404) {
        throw new BadRequestException(
          'Your Growth Partner profile could not be found. Please contact support to re-link your affiliate account before referring a company.',
        );
      }
      // Other errors (network, rate limit) → do not block; let the flow continue.
    }
  }

  private async executeRollback(
    cleanupStack: Array<() => Promise<void>>,
  ): Promise<void> {
    for (let i = cleanupStack.length - 1; i >= 0; i--) {
      try {
        await cleanupStack[i]();
      } catch (cleanupError) {
        console.error(`[rollback] Cleanup step ${i} failed:`, cleanupError);
      }
    }
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
  // Admin: create referral on behalf of an affiliate.
  // ---------------------------------------------------------------------------
  async createAdminInitiated(
    affiliateId: string,
    dto: CreateReferredCompanyDto,
  ) {
    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
      select: { id: true, user_id: true, status: true },
    });
    if (!profile) throw new NotFoundException('Affiliate profile not found');
    if (profile.status !== 'active')
      throw new ForbiddenException('Affiliate profile is not active');
    if (!profile.user_id)
      throw new BadRequestException('Affiliate has no connected user');

    const affiliateUser = await this.prisma.uSER.findUnique({
      where: { id: profile.user_id },
    });
    if (!affiliateUser)
      throw new NotFoundException('Affiliate user account not found');

    return this.create(dto, affiliateUser);
  }

  // ---------------------------------------------------------------------------
  // Affiliate: list own referred companies.
  // ---------------------------------------------------------------------------
  async findAllForAffiliate(dto: ListReferredCompaniesDto, currentUser: USER) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = dto;
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
          contact_email: true,
          med_alliance_referral_status: true,
          eligibility_start_at: true,
          referral_stage: true,
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
      } else if (
        comms.some((c) => c.status === 'eligible' || c.status === 'requested')
      ) {
        commission_status = 'eligible';
      } else if (
        comms.some(
          (c) =>
            c.status === 'detected' ||
            c.status === 'pending_admin_confirmation',
        )
      ) {
        commission_status = 'pending';
      }

      const { affiliateCommissions: _, eligibility_start_at, ...rest } = org;
      return {
        ...rest,
        med_alliance_referral_status: computeEffectiveStatus(
          org.med_alliance_referral_status,
          eligibility_start_at,
        ),
        my_commissions,
        commission_status,
      };
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
      throw new ForbiddenException(
        'You do not have access to this referred company',
      );
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
        eligibility_start_at: true,
        referral_stage: true,
        affiliateCommissions: {
          where: {
            affiliate_id: currentUser.id,
            status: { in: AFFILIATE_VISIBLE_STATUSES as any[] },
          },
          select: {
            id: true,
            commission_amount: true,
            commission_percent_snapshot: true,
            base_amount_snapshot: true,
            status: true,
            createdAt: true,
            hubspotInvoiceSnapshot: {
              select: {
                hubspot_id: true,
                invoice_amount: true,
                invoice_status: true,
                paid_at: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!org) return org;
    const { eligibility_start_at, ...rest } = org;
    return {
      ...rest,
      med_alliance_referral_status: computeEffectiveStatus(
        org.med_alliance_referral_status,
        eligibility_start_at,
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // Admin: list all referred companies (no affiliate scoping).
  // ---------------------------------------------------------------------------
  async findAllForAdmin(dto: ListReferredCompaniesDto) {
    const {
      page = 1,
      limit = 100,
      search,
      status,
      affiliate_id,
      affiliate_user_id,
      referral_stage,
      med_alliance_referral_status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
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
    if (affiliate_user_id) where.referred_by_affiliate_id = affiliate_user_id;
    if (referral_stage) where.referral_stage = referral_stage;
    if (med_alliance_referral_status)
      where.med_alliance_referral_status = med_alliance_referral_status;

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
          eligibility_start_at: true,
          referral_stage: true,
          hubspot_id: true,
          hubspot_sync_status: true,
          createdAt: true,
          referredByAffiliate: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
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

      const {
        affiliateCommissions: _,
        _count: __,
        eligibility_start_at,
        ...rest
      } = org;
      return {
        ...rest,
        eligibility_start_at,
        med_alliance_referral_status: computeEffectiveStatus(
          org.med_alliance_referral_status,
          eligibility_start_at,
        ),
        total_paid,
        total_pending,
        has_open_review,
      };
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
        eligibility_start_at: true,
        first_paid_invoice_at: true,
        med_alliance_block_reason: true,
        referral_stage: true,
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
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            role: true,
          },
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
              select: {
                hubspot_id: true,
                invoice_amount: true,
                invoice_status: true,
                paid_at: true,
              },
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
    const { eligibility_start_at, ...rest } = org;
    return {
      ...rest,
      eligibility_start_at,
      med_alliance_referral_status: computeEffectiveStatus(
        org.med_alliance_referral_status,
        eligibility_start_at,
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // Admin: update the pipeline stage for a referred company.
  // Starting the deployed stage also starts the 30-day eligibility clock.
  // ---------------------------------------------------------------------------
  async updateReferralStage(
    id: string,
    dto: UpdateReferralStageDto,
    adminUser: USER,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        referral_stage: true,
        eligibility_start_at: true,
        referred_by_affiliate_id: true,
      },
    });
    if (!org) throw new NotFoundException('Referred company not found');
    if (!org.referred_by_affiliate_id)
      throw new BadRequestException('Not a referred company');

    const dataUpdate: Record<string, unknown> = { referral_stage: dto.stage };

    // Manually moving to deployed starts the eligibility clock: eligible 30 days from now.
    if (dto.stage === 'deployed' && !org.eligibility_start_at) {
      dataUpdate.eligibility_start_at = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      );
    }

    await this.prisma.organization.update({
      where: { id },
      data: dataUpdate as any,
    });

    await this.prisma.medAllianceAuditLog.create({
      data: {
        entity_type: 'referred_company',
        entity_id: id,
        event: 'stage_changed',
        old_status: org.referral_stage ?? 'referred',
        new_status: dto.stage,
        reason: dto.reason ?? null,
        source: 'admin_action',
        actor_user_id: adminUser.id,
        metadata: dataUpdate.eligibility_start_at
          ? ({
              eligibility_start_at: (
                dataUpdate.eligibility_start_at as Date
              ).toISOString(),
            } as any)
          : undefined,
      },
    });

    return this.findOneForAdmin(id);
  }

  // Get available referral options for the "referred_to" field when creating a referral (i.e. list of active users to whom the referral can be assigned).
  async getReferredToOptions(): Promise<any> {
    try {
      const url = 'https://api.hubapi.com/crm/v3/properties/contacts';
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      const vaTypeProperty = response.data.results.find(
        (prop) => prop.name === 'referred_to',
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
      console.error(
        'Failed to find Referred To options:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to find Referred To options');
    }
  }

  async checkContactEmailInHubspot(email: string): Promise<boolean> {
    if (!email) return false;
    try {
      const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/contacts/search',
        {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'EQ',
                  value: email.toLowerCase(),
                },
              ],
            },
          ],
          limit: 1,
          properties: ['email'],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return (response.data?.total ?? 0) > 0;
    } catch {
      // HubSpot unavailable → never block the form
      return false;
    }
  }
}
