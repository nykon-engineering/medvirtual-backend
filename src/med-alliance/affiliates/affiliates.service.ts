import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { USER } from '@prisma/client';
import { CreateAffiliateProfileDto } from './dto/create-affiliate-profile.dto';
import {
  JoinProgramDto,
  LinkOrganizationDto,
  UpdateAffiliatePayoutPreferencesDto,
  UpdateAffiliateProfileDto,
} from './dto/update-affiliate-profile.dto';
import { ListAffiliatesDto } from './dto/list-affiliates.dto';
import { MailService } from '../../mail/mail.service';
import { MedAllianceInvitation } from '../../common/utils/email-templates/med-alliance-invitation';
import { getUserEmailTheme } from '../../common/utils/email-templates/theme-helper';
import { AffiliateCreationService } from '../../hubspot/create/affiliate';

// Fields returned for the linked user — never expose password or sensitive tokens.
const USER_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  organization_id: true,
  role: true,
  status: true,
};

@Injectable()
export class AffiliatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly affiliateCreationService: AffiliateCreationService,
  ) {}
  
  // Shared helper: ensure a user has an active AffiliateProfile.
  // Used by other services (commissions, payout-requests).
  async requireActiveProfile(userId: string) {
    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { user_id: userId },
    });
    if (!profile) {
      throw new ForbiddenException('Affiliate profile not found');
    }
    if (profile.status !== 'active') {
      throw new ForbiddenException('Affiliate profile is inactive');
    }
    return profile;
  }

  private buildFromWithPrefix(from: string): string {
    const isProduction = process.env.ENVIRONMENT === 'PROD';
    return isProduction ? from : `[DEV] ${from}`;
  }

  
  async create(dto: CreateAffiliateProfileDto, adminUser: USER) {
    const user = await this.prisma.uSER.findUnique({
      where: { id: dto.user_id },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent duplicate profile — give a clear message before hitting DB constraint.
    const existing = await this.prisma.affiliateProfile.findUnique({
      where: { user_id: dto.user_id },
    });
    if (existing) {
      throw new ConflictException('This user already has an affiliate profile');
    }

    const profile = await this.prisma.affiliateProfile.create({
      data: {
        user_id: dto.user_id,
        hubspot_id: dto.hubspot_id ?? null,
        commission_percent_default: dto.commission_percent_default,
        payout_preference_method: dto.payout_preference_method ?? null,
        payout_preference_reference: dto.payout_preference_reference ?? null,
        payout_preference_notes: dto.payout_preference_notes ?? null,
        payout_details: dto.payout_details ?? undefined,
        created_by: adminUser.id,
      },
    });

    const newAffiliateData = await this.findOne(profile.id);

    // => Create Growth Partner in Hubspot
    try{
      await this.affiliateCreationService.execute(newAffiliateData);
      console.log('[Hubspot] Growth Partner created in Hubspot for affiliate profile ID:', profile.id);
    }catch(error){
      await this.prisma.affiliateProfile.delete({ where: { id: profile.id } });
      console.error('Failed to create Growth Partner in Hubspot:', error);
      throw new BadRequestException(error.message || 'Failed to create Growth Partner in Hubspot. The affiliate profile has not been created. Please try again later.');
    }

    // Send invitation email to the new affiliate.
    try {
      const theme = await getUserEmailTheme(this.prisma, dto.user_id);
      await this.mailService.sendMail({
        from: this.buildFromWithPrefix('MedVirtual <noreply@medvirtual.ai>'),
        to: user.email,
        subject: "You've been invited to join the Med Alliance Program",
        html: MedAllianceInvitation(user.first_name, theme ?? undefined),
      });
    } catch (emailError) {
      // Do not fail the whole request if the email could not be delivered.
      console.error('Failed to send Med Alliance invitation email:', emailError);
    }

  
    return newAffiliateData;
  }


  async findByUserId(userId: string) {
    return this.prisma.affiliateProfile.findUnique({
      where: { user_id: userId },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });
  }

  async findAll(dto: ListAffiliatesDto) {
    const { page = 1, limit = 20, search, status, sortOrder = 'desc' } = dto;
    const skip = (page - 1) * limit;

    // Build where clause — search applies to the linked user's name/email.
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.user = {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.affiliateProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortOrder },
        include: {
          user: {
            select: {
              ...USER_SELECT,
              organization: { select: { id: true, name: true } },
              _count: { select: { referredOrganizations: true } },
            },
          },
        },
      }),
      this.prisma.affiliateProfile.count({ where }),
    ]);

    return { data, pagination: { page, limit, total } };
  }

  async getAdminDashboardStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      openPayouts,
      underReviewAgg,
      activeAffiliates,
      newReferrals,
      payoutGroups,
      requestedGroups,
    ] = await Promise.all([
      this.prisma.affiliatePayoutRequest.count({ where: { status: 'requested' } }),
      this.prisma.affiliatePayoutRequest.aggregate({
        _sum: { requested_amount: true },
        where: { status: 'under_review' },
      }),
      this.prisma.affiliateProfile.count({ where: { status: 'active' } }),
      this.prisma.organization.count({
        where: {
          referred_by_affiliate_id: { not: null },
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.affiliatePayoutRequest.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { status: { in: ['requested', 'under_review', 'paid', 'rejected'] } },
      }),
      // Fetch all affiliate groups with 'requested' payouts — filter for >1 in JS
      this.prisma.affiliatePayoutRequest.groupBy({
        by: ['affiliate_id'],
        _count: { id: true },
        where: { status: 'requested' },
      }),
    ]);

    const payoutSummaryMap: Record<string, number> = {};
    for (const row of payoutGroups) {
      payoutSummaryMap[row.status] = row._count.id;
    }

    const duplicateRiskFlags = requestedGroups.filter((r) => r._count.id > 1).length;

    return {
      open_payout_requests: openPayouts,
      under_review_amount: Number(underReviewAgg._sum.requested_amount ?? 0),
      active_affiliates: activeAffiliates,
      new_referred_companies_30d: newReferrals,
      duplicate_risk_flags: duplicateRiskFlags,
      payout_summary: {
        submitted: payoutSummaryMap['requested'] ?? 0,
        under_review: payoutSummaryMap['under_review'] ?? 0,
        paid: payoutSummaryMap['paid'] ?? 0,
        rejected: payoutSummaryMap['rejected'] ?? 0,
      },
    };
  }

  async getMyStats(currentUser: USER) {
    await this.requireActiveProfile(currentUser.id);

    const [totalAgg, eligibleAgg, requestedAgg, lastPayout, recentCommissions] =
      await Promise.all([
        this.prisma.affiliateCommission.aggregate({
          _sum: { commission_amount: true },
          where: {
            affiliate_id: currentUser.id,
            status: { notIn: ['void', 'rejected'] },
          },
        }),
        this.prisma.affiliateCommission.aggregate({
          _sum: { commission_amount: true },
          where: { affiliate_id: currentUser.id, status: 'eligible' },
        }),
        this.prisma.affiliatePayoutRequest.aggregate({
          _sum: { requested_amount: true },
          where: {
            affiliate_id: currentUser.id,
            status: { in: ['requested', 'under_review'] },
          },
        }),
        this.prisma.affiliatePayoutRequest.findFirst({
          where: { affiliate_id: currentUser.id, status: 'paid' },
          orderBy: { paid_at: 'desc' },
          select: { paid_amount: true, paid_at: true },
        }),
        this.prisma.affiliateCommission.findMany({
          where: { affiliate_id: currentUser.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { organization: { select: { id: true, name: true } } },
        }),
      ]);

    return {
      total_earnings: Number(totalAgg._sum.commission_amount ?? 0),
      eligible_amount: Number(eligibleAgg._sum.commission_amount ?? 0),
      requested_amount: Number(requestedAgg._sum.requested_amount ?? 0),
      last_payout: lastPayout
        ? {
            paid_at: lastPayout.paid_at?.toISOString() ?? null,
            amount: Number(lastPayout.paid_amount ?? 0),
          }
        : null,
      recent_commissions: recentCommissions.map((c) => ({
        id: c.id,
        organization_id: c.organization_id,
        organization_name: c.organization?.name ?? '',
        invoice_id: c.hubspot_invoice_snapshot_id,
        base_amount: Number(c.base_amount_snapshot),
        commission_percentage: Number(c.commission_percent_snapshot),
        commission_amount: Number(c.commission_amount),
        status: c.status,
        created_at: c.createdAt.toISOString(),
      })),
    };
  }

  async findOne(id: string) {
    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            ...USER_SELECT,
            referredOrganizations: {
              where: { status: { not: 'deleted' } },
              select: {
                id: true,
                name: true,
                email: true,
                status: true,
                med_alliance_referral_status: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' as const },
            },
            organization: { 
              select: { 
                id: true, 
                name: true,
                business_unit: true,
                hubspot_id: true,
              } 
            },
          },
        },
        commissions: {
          select: {
            id: true,
            status: true,
            commission_amount: true,
            createdAt: true,
            organization: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' as const },
          take: 10,
        },
      },
    });
    if (!profile) throw new NotFoundException('Affiliate profile not found');
    return profile;
  }

  async update(id: string, dto: UpdateAffiliateProfileDto) {
    await this.findOne(id); // ensures it exists

    return this.prisma.affiliateProfile.update({
      where: { id },
      data: {
        ...(dto.commission_percent_default !== undefined && {
          commission_percent_default: dto.commission_percent_default,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.payout_preference_method !== undefined && {
          payout_preference_method: dto.payout_preference_method,
        }),
        ...(dto.payout_preference_reference !== undefined && {
          payout_preference_reference: dto.payout_preference_reference,
        }),
        ...(dto.payout_preference_notes !== undefined && {
          payout_preference_notes: dto.payout_preference_notes,
        }),
        ...(dto.payout_details !== undefined && {
          payout_details: dto.payout_details ?? undefined,
        }),
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  async findOwn(currentUser: USER) {
    const profile = await this.prisma.affiliateProfile.findUnique({
      where: { user_id: currentUser.id },
      include: { user: { select: USER_SELECT } },
    });
    if (!profile) throw new NotFoundException('Affiliate profile not found');
    return profile;
  }

  // Self-enrollment: organization admin joins the Med Alliance Program.
  async joinProgram(currentUser: USER, dto: JoinProgramDto = {}) {
      if (!['organization_admin', 'organization_super_admin'].includes(currentUser.role)) {
        throw new ForbiddenException('Only organization admins can join the Med Alliance Program');
      }

      const existing = await this.prisma.affiliateProfile.findUnique({
        where: { user_id: currentUser.id },
      });
      if (existing) {
        throw new ConflictException('You already have an affiliate profile');
      }

      const profile = await this.prisma.affiliateProfile.create({
        data: {
          full_name: `${currentUser.first_name} ${currentUser.last_name}`,
          user_id: currentUser.id,
          commission_percent_default: 7,
          status: 'active',
          created_by: currentUser.id,
          payout_details: dto.payout_details ?? undefined,
        },
      });

      const newAffiliateData = await this.findOne(profile.id);

      // => Create Growth Partner in Hubspot
      try{
        await this.affiliateCreationService.execute(newAffiliateData);
        console.log('[Hubspot] Growth Partner created in Hubspot for affiliate profile ID:', profile.id);
      }catch(error){
        await this.prisma.affiliateProfile.delete({ where: { id: profile.id } });
        throw new BadRequestException(error.message || 'Failed to create Growth Partner in Hubspot. The affiliate profile has not been created. Please try again later.');
      }


      try {
        const theme = await getUserEmailTheme(this.prisma, currentUser.id);
        await this.mailService.sendMail({
          from: process.env.MAIL_FROM || 'noreply@medvirtual.ai',
          to: currentUser.email,
          subject: 'Welcome to the Med Alliance Program',
          html: MedAllianceInvitation(currentUser.first_name, theme ?? undefined),
        });
      } catch (emailError) {
        console.error('Failed to send Med Alliance invitation email:', emailError);
      }

      return  newAffiliateData;
  }

  // Admin: link the affiliate's connected user to an existing organization.
  async linkOrganization(id: string, dto: LinkOrganizationDto) {
    const profile = await this.findOne(id); // ensures profile exists

    const org = await this.prisma.organization.findUnique({
      where: { id: dto.organization_id },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    await this.prisma.uSER.update({
      where: { id: profile.user_id },
      data: { organization_id: dto.organization_id },
    });

    return this.findOne(id);
  }

  // Affiliate: update only payout preferences on own profile.
  async updateOwn(currentUser: USER, dto: UpdateAffiliatePayoutPreferencesDto) {
    const profile = await this.requireActiveProfile(currentUser.id);

    return this.prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.payout_preference_method !== undefined && {
          payout_preference_method: dto.payout_preference_method,
        }),
        ...(dto.payout_preference_reference !== undefined && {
          payout_preference_reference: dto.payout_preference_reference,
        }),
        ...(dto.payout_preference_notes !== undefined && {
          payout_preference_notes: dto.payout_preference_notes,
        }),
        ...(dto.payout_details !== undefined && {
          payout_details: dto.payout_details ?? null,
        }),
      },
      include: { user: { select: USER_SELECT } },
    });
  }
}
