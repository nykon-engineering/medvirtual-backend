import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommissionStatus, USER } from '@prisma/client';
import { CreateAffiliateProfileDto } from './dto/create-affiliate-profile.dto';
import {
  JoinProgramDto,
  LinkOrganizationDto,
  UpdateAffiliatePayoutPreferencesDto,
  UpdateAffiliateProfileDto,
} from './dto/update-affiliate-profile.dto';
import { ListAffiliatesDto } from './dto/list-affiliates.dto';
import { MailService } from '../../mail/mail.service';

import { getUserEmailTheme } from '../../common/utils/email-templates/theme-helper';
import { AffiliateCreationService } from '../../hubspot/create/affiliate';
import { AffiliateUpdateService } from '../../hubspot/update/affiliate';
import { CreateUserAndAffiliateProfileDto } from './dto/create-user-and-affiliate.dto';

import * as jwt from 'jsonwebtoken';
import InviteSignup from '../../common/utils/email-templates/invite-signup';
import { MedAllianceInvitation } from '../../common/utils/email-templates/med-alliance-invitation';
import { MedAllianceInvitationForOrgUsers } from '../../common/utils/email-templates/med-alliance-invitation-for-org-users';
import { AFFILIATE_VISIBLE_STATUSES } from '../../common/constant/commissions';

// Fields returned for the linked user — never expose password or sensitive tokens.
const USER_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  organization_id: true,
  role: true,
  status: true,
  status_before_deactivation: true,
};

@Injectable()
export class AffiliatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly affiliateCreationService: AffiliateCreationService,
    private readonly affiliateUpdateService: AffiliateUpdateService,
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


  async createUserandAffiliate(dto: CreateUserAndAffiliateProfileDto, adminUser: USER) {
    //1. Create user
      const user = await this.prisma.uSER.create({
          data: {
              email: dto.email,
              first_name: dto.first_name,
              last_name: dto.last_name,
              phone: '',
              avatar: '',
              organization_name: '',
              role: dto.role,
              job_title: '',
              workos_id: '',
              password: '',
              authentication_method: 'OwnSign',
              status: 'invited'
          }
      });

      // Generate invitation token
      const code = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '48h',
      });

      // Get user email theme
      const emailTheme = await getUserEmailTheme(this.prisma, user.id);
      
      // Send signup link via email
      const baseInviteLink = `${process.env.FRONTEND_URL}/invite-signup?code=${code}`;
      const inviteLink = emailTheme?.companyName === 'Berry Virtual' 
      ? `${baseInviteLink}&company=berry` 
      : baseInviteLink;
      const emailBody = InviteSignup(inviteLink, emailTheme || undefined);
      const mailSent = await this.mailService.sendMail({
      from: this.buildFromWithPrefix(`${emailTheme?.companyName || 'MedVirtual'} <noreply@medvirtual.ai>`),
      to: dto.email,
      subject: `Welcome to ${emailTheme?.companyName || 'MedVirtual'} - Complete Your Affiliate Account Setup`,
      html: emailBody,
      headers: {
          'X-Mailer': `${emailTheme?.companyName || 'MedVirtual'} Platform`,
          'X-Priority': '3',
          'List-Unsubscribe': '<mailto:unsubscribe@medvirtual.ai>',
          'X-Entity-Ref-ID': `invite-${user.id}`,
      },
      });

      if (!mailSent) {
          throw new BadRequestException('Failed to send invitation email');
      }

      // Store the verification code in the database with an expiration time
      const codeExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours - same time as JWT
      const storeCode = await this.prisma.emailInvitation.create({
      data: {
          userId: user.id,
          email_from: dto.email,
          code: code,
          expiresAt: codeExpiresAt,
      },
      });
      if (!storeCode) {
          throw new BadRequestException('Failed to store invite code');
      }
    // End Create user

    // Prevent duplicate profile — give a clear message before hitting DB constraint.
    const existing = await this.prisma.affiliateProfile.findUnique({
      where: { user_id: user.id },
    });
    if (existing) {
      throw new ConflictException('This user already has an affiliate profile');
    }

    const profile = await this.prisma.affiliateProfile.create({
      data: {
        user_id: user.id,
        hubspot_id: null,
        commission_percent_default: 7,
        payout_preference_method: null,
        payout_preference_reference: null,
        payout_preference_notes: null,
        payout_details: undefined,
        created_by: adminUser.id,
        status: 'invited',
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
    const { page = 1, limit = 20, search, status, banking, organization, sortOrder = 'desc' } = dto;
    const skip = (page - 1) * limit;

    // Build where clause — search applies to the linked user's name/email.
    const where: any = {};
    if (status) where.status = status;

    // Banking filter: payout_details being non-null indicates banking is complete.
    if (banking === 'complete') {
      where.payout_details = { not: null };
    } else if (banking === 'incomplete') {
      where.payout_details = null;
    }

    // Build user-level conditions (search + organization may both apply).
    const userConditions: any = {};
    if (search) {
      userConditions.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (organization === 'with_org') {
      userConditions.organization_id = { not: null };
    } else if (organization === 'without_org') {
      userConditions.organization_id = null;
    }

    if (Object.keys(userConditions).length > 0) {
      where.user = userConditions;
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
            status: { in: AFFILIATE_VISIBLE_STATUSES as CommissionStatus[] },
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
          where: { 
            affiliate_id: currentUser.id,
            status: { in: AFFILIATE_VISIBLE_STATUSES as CommissionStatus[] }
           },
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
            hubspot_contact_id: true,
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
          html: MedAllianceInvitationForOrgUsers(currentUser.first_name, theme ?? undefined),
        });
      } catch (emailError) {
        console.error('Failed to send Med Alliance invitation email:', emailError);
      }

      return  newAffiliateData;
  }

  // Admin: search for platform users that don't have an affiliate profile yet.
  async searchEligibleUsers(email: string) {
    if (!email || email.length < 3) return [];
    return this.prisma.uSER.findMany({
      where: {
        email: { contains: email, mode: 'insensitive' },
        affiliateProfile: null,
      },
      select: { id: true, first_name: true, last_name: true, email: true, role: true },
      take: 10,
    });
  }

  // Admin: list active organization_admin / organization_super_admin users
  // that do not yet have an affiliate profile — used to populate the
  // "Use an existing user" dropdown in the Create Affiliate modal.
  async findEligibleOrgUsers(search?: string) {
    const where: any = {
      status: 'active',
      role: { in: ['organization_admin', 'organization_super_admin'] },
      affiliateProfile: null,
    };

    if (search && search.trim().length > 0) {
      where.OR = [
        { first_name: { contains: search.trim(), mode: 'insensitive' } },
        { last_name: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    return this.prisma.uSER.findMany({
      where,
      select: { id: true, first_name: true, last_name: true, email: true, role: true },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
      //take: 100,
    });
  }

  // Admin: get enriched affiliate detail — adds financial aggregates + payout history.
  // Keeps findOne() lightweight for internal use (create / joinProgram).
  async findOneEnriched(id: string) {
    const profile = await this.findOne(id);
    const userId = profile.user_id;

    const [pendingAgg, lifetimeAgg, payoutHistory, commsByOrg] = await Promise.all([
      this.prisma.affiliatePayoutRequest.aggregate({
        _sum: { requested_amount: true },
        where: { affiliate_id: userId, status: { in: ['requested', 'under_review'] } },
      }),
      this.prisma.affiliateCommission.aggregate({
        _sum: { commission_amount: true },
        where: { affiliate_id: userId, status: { notIn: ['void', 'rejected'] } },
      }),
      this.prisma.affiliatePayoutRequest.findMany({
        where: { affiliate_id: userId, status: 'paid' },
        orderBy: { paid_at: 'desc' },
        take: 20,
        select: {
          id: true,
          paid_amount: true,
          paid_at: true,
          payment_method: true,
          transaction_reference: true,
          requested_amount: true,
        },
      }),
      this.prisma.affiliateCommission.groupBy({
        by: ['organization_id'],
        where: { affiliate_id: userId, status: { notIn: ['void', 'rejected'] } },
        _sum: { commission_amount: true },
      }),
    ]);

    return { profile, pendingAgg, lifetimeAgg, payoutHistory, commsByOrg };
  }

  // Admin: deactivate an affiliate profile (and optionally the user account).
  // - If the user's role is 'affiliate': deactivates both the user account and the profile.
  // - If the user's role is 'organization_admin' or 'organization_super_admin': deactivates only the profile.
  async deactivate(id: string) {
    const profile = await this.findOne(id);
    const user = profile.user as any;

    await this.prisma.affiliateProfile.update({
      where: { id },
      data: { status: 'inactive' },
    });

    if (user.role === 'affiliate') {
      await this.prisma.uSER.update({
        where: { id: profile.user_id },
        data: {
          status: 'inactive',
          status_before_deactivation: user.status,
        },
      });
    }

    if (profile.hubspot_id) {
      await this.affiliateUpdateService.deactivate(profile.hubspot_id);
    }
  }

  // Admin: delete an invited affiliate profile (only allowed for status='invited').
  // - If the user's role is 'affiliate': soft-deletes the user account AND hard-deletes the profile.
  // - If the user's role is 'organization_admin' or 'organization_super_admin': deletes only the profile.
  async deleteInvited(id: string) {
    const profile = await this.findOne(id);
    const user = profile.user as any;

    if (profile.status !== 'invited') {
      throw new BadRequestException('Only invited affiliates can be deleted');
    }

    // Always hard-delete the affiliate profile
    // Hard-delete the user account — the user never completed signup (status='invited'),
    // so there is no data to preserve and the email must be freely reusable.
    await this.prisma.$transaction(async (tx) => {
      await tx.affiliateProfile.delete({ where: { id } });
      await tx.emailInvitation.deleteMany({ where: { userId: user.id } });
      await tx.uSER.delete({
        where: { id: user.id },
      });
    })
    
  }

  // Admin: reactivate an inactive affiliate profile (and user account if role is 'affiliate').
  // - If the user's role is 'affiliate': restores user status (from status_before_deactivation or 'active') AND profile status → 'active'.
  // - If the user's role is 'organization_admin' or 'organization_super_admin': reactivates profile only.
  async reactivate(id: string) {
    const profile = await this.findOne(id);
    const user = profile.user as any;

    if (profile.status !== 'inactive') {
      throw new BadRequestException('Only inactive affiliates can be reactivated');
    }

    // Always reactivate the affiliate profile
    await this.prisma.affiliateProfile.update({
      where: { id },
      data: { status: 'active' },
    });

    // If user role is 'affiliate', restore the user account status
    if (user.role === 'affiliate') {
      await this.prisma.uSER.update({
        where: { id: profile.user_id },
        data: {
          status: user.status_before_deactivation ?? 'active',
          status_before_deactivation: null,
        },
      });
    }

    if (profile.hubspot_id) {
      await this.affiliateUpdateService.reactivate(profile.hubspot_id);
    }
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
