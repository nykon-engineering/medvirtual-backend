import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AffiliatesService } from './affiliates.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { ADMIN_ROLES, AFFILIATE_ROLES, ORGANIZATION_ROLES } from '../constants';
import { CreateAffiliateProfileDto } from './dto/create-affiliate-profile.dto';
import {
  JoinProgramDto,
  LinkOrganizationDto,
  UpdateAffiliatePayoutPreferencesDto,
  UpdateAffiliateProfileDto,
} from './dto/update-affiliate-profile.dto';
import { ListAffiliatesDto } from './dto/list-affiliates.dto';
import { CreateUserAndAffiliateProfileDto } from './dto/create-user-and-affiliate.dto';

@Controller('med-alliance')
@UseGuards(AuthGuard, RolesGuard)
export class AffiliatesController {
  constructor(private readonly affiliatesService: AffiliatesService) {}

  // ---------------------------------------------------------------------------
  // Admin routes
  // ---------------------------------------------------------------------------

  // POST /med-alliance/admin/affiliates — Create an affiliate profile for a user.
  @Post('admin/affiliates')
  @HttpCode(201)
  @Roles(...ADMIN_ROLES)
  async create(
    @Body() dto: CreateAffiliateProfileDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.affiliatesService.create(dto, admin);
    return data;
  }

  // POST /med-alliance/admin/user-and-affiliates — Create both a user and an affiliate profile in one step (for manual enrollments when the user doesn't exist yet).
  @Post('admin/user-and-affiliates')
  @HttpCode(201)
  @Roles(...ADMIN_ROLES)
  async createUserAndAffiliate(
    @Body() dto: CreateUserAndAffiliateProfileDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.affiliatesService.createUserandAffiliate(dto, admin);
    return data;
  }

  // GET /med-alliance/admin/affiliates — List all affiliate profiles.
  @Get('admin/affiliates')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findAll(@Query() query: ListAffiliatesDto) {
    const result = await this.affiliatesService.findAll(query);
    const data = result.data.map((profile) => {
      const user = profile.user as any;
      return {
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name || `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim(),
        email: user?.email ?? '',
        status: profile.status,
        commission_percent_default: Number(profile.commission_percent_default),
        payout_preference_method: profile.payout_preference_method,
        payout_preference_reference: profile.payout_preference_reference,
        payout_preference_notes: profile.payout_preference_notes,
        payout_details: profile.payout_details,
        banking_complete: !!(profile.payout_details),
        linked_company: user?.organization?.name ?? null,
        linked_company_id: user?.organization?.id ?? null,
        referred_companies_count: user?._count?.referredOrganizations ?? 0,
        pending_payout_amount: 0,
        lifetime_commissions: 0,
        hubspot_id: profile.hubspot_id ?? null,
        created_at: profile.createdAt.toISOString(),
        hubspot_pipeline: profile.hubspot_pipeline ?? null,
        hubspot_pipeline_stage: profile.hubspot_pipeline_stage ?? null,
        business_unit: profile.business_unit ?? null,
        user_role: user?.role ?? null,
      };
    });
    return { status: 200, message: 'Affiliate profiles retrieved successfully', data, pagination: result.pagination };
  }

  // GET /med-alliance/admin/stats — Aggregated KPI stats for the admin dashboard.
  // Must be declared before /:id routes.
  @Get('admin/stats')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async getAdminStats() {
    const data = await this.affiliatesService.getAdminDashboardStats();
    return { status: 200, message: 'Admin dashboard stats retrieved successfully', data };
  }

  // GET /med-alliance/admin/users/eligible?email=xxx — Search platform users without an affiliate profile.
  // Used by the "Create Affiliate" modal to find existing users.
  @Get('admin/users/eligible')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async searchEligibleUsers(@Query('email') email: string) {
    const data = await this.affiliatesService.searchEligibleUsers(email ?? '');
    return { status: 200, message: 'Eligible users retrieved successfully', data };
  }

  // GET /med-alliance/admin/users/eligible-org-users?search=xxx
  // Returns active organization_admin / organization_super_admin users
  // that do not yet have an affiliate profile.
  @Get('admin/users/eligible-org-users')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findEligibleOrgUsers(@Query('search') search?: string) {
    const data = await this.affiliatesService.findEligibleOrgUsers(search);
    return { status: 200, message: 'Eligible org users retrieved successfully', data };
  }

  // GET /med-alliance/admin/affiliates/by-user/:userId — Get affiliate profile by user ID.
  // Must be declared BEFORE the /:id route so NestJS does not treat "by-user" as an id.
  @Get('admin/affiliates/by-user/:userId')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findByUserId(@Param('userId') userId: string) {
    const data = await this.affiliatesService.findByUserId(userId);
    return { status: 'success', data };
  }

  // GET /med-alliance/admin/affiliates/:id — Get one affiliate profile (enriched for side panel).
  @Get('admin/affiliates/:id')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findOne(@Param('id') id: string) {
    const enriched = await this.affiliatesService.findOneEnriched(id);
    const profile = enriched.profile;
    const user = profile.user as any;

    const commsByOrgMap: Record<string, number> = Object.fromEntries(
      enriched.commsByOrg.map((r: any) => [
        r.organization_id,
        Number(r._sum.commission_amount ?? 0),
      ])
    );

    const data = {
      id: profile.id,
      user_id: profile.user_id,
      full_name: profile.full_name || `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim(),
      email: user?.email ?? '',
      status: profile.status,
      commission_percent_default: Number(profile.commission_percent_default),
      payout_preference_method: profile.payout_preference_method,
      payout_preference_reference: profile.payout_preference_reference,
      payout_preference_notes: profile.payout_preference_notes,
      payout_details: profile.payout_details,
      banking_complete: !!(profile.payout_details),
      linked_company: user?.organization?.name ?? null,
      linked_company_id: user?.organization?.id ?? null,
      referred_companies_count: user?.referredOrganizations?.length ?? 0,
      pending_payout_amount: Number(enriched.pendingAgg._sum.requested_amount ?? 0),
      lifetime_commissions: Number(enriched.lifetimeAgg._sum.commission_amount ?? 0),
      hubspot_id: profile.hubspot_id ?? null,
      hubspot_pipeline: profile.hubspot_pipeline ?? null,
      hubspot_pipeline_stage: profile.hubspot_pipeline_stage ?? null,
      business_unit: profile.business_unit ?? null,
      created_at: profile.createdAt.toISOString(),
      referred_companies: (user?.referredOrganizations ?? []).map((org: any) => ({
        id: org.id,
        name: org.name,
        referral_status: org.med_alliance_referral_status ?? org.status,
        total_commissions: commsByOrgMap[org.id] ?? 0,
      })),
      recent_commissions: (profile.commissions ?? []).map((c: any) => ({
        id: c.id,
        organization_name: c.organization?.name ?? '',
        amount: Number(c.commission_amount),
        status: c.status,
        date: c.createdAt.toISOString(),
      })),
      payout_history: enriched.payoutHistory.map((pr: any) => ({
        id: pr.id,
        payout_request_id: pr.id,
        amount: Number(pr.paid_amount ?? pr.requested_amount ?? 0),
        paid_at: pr.paid_at?.toISOString() ?? '',
        payment_method: pr.payment_method ?? '',
        transaction_reference: pr.transaction_reference ?? null,
        status: 'paid' as const,
      })),
    };

    return { status: 200, message: 'Affiliate profile retrieved successfully', data };
  }

  // PATCH /med-alliance/admin/affiliates/:id/deactivate — Deactivate affiliate profile (and user if role is 'affiliate').
  @Patch('admin/affiliates/:id/deactivate')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async deactivate(@Param('id') id: string) {
    await this.affiliatesService.deactivate(id);
    return { status: 200, message: 'Affiliate deactivated successfully' };
  }

  // PATCH /med-alliance/admin/affiliates/:id/reactivate — Reactivate affiliate (and user if role is 'affiliate').
  @Patch('admin/affiliates/:id/reactivate')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async reactivate(@Param('id') id: string) {
    await this.affiliatesService.reactivate(id);
    return { status: 200, message: 'Affiliate reactivated successfully' };
  }

  // DELETE /med-alliance/admin/affiliates/:id — Delete an invited affiliate (status must be 'invited').
  @Delete('admin/affiliates/:id')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async deleteInvited(@Param('id') id: string) {
    await this.affiliatesService.deleteInvited(id);
    return { status: 200, message: 'Affiliate deleted successfully' };
  }

  // PATCH /med-alliance/admin/affiliates/:id — Update profile (admin full access).
  @Patch('admin/affiliates/:id')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAffiliateProfileDto,
  ) {
    const data = await this.affiliatesService.update(id, dto);
    return { status: 200, message: 'Affiliate profile updated successfully', data };
  }

  // PATCH /med-alliance/admin/affiliates/:id/link-organization — Link user to an org.
  @Patch('admin/affiliates/:id/link-organization')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async linkOrganization(
    @Param('id') id: string,
    @Body() dto: LinkOrganizationDto,
  ) {
    const data = await this.affiliatesService.linkOrganization(id, dto);
    return { status: 200, message: 'Organization linked successfully', data };
  }

  // ---------------------------------------------------------------------------
  // Affiliate routes
  // ---------------------------------------------------------------------------

  // POST /med-alliance/affiliates/join — Self-enrollment for organization admins.
  @Post('affiliates/join')
  @HttpCode(201)
  @Roles(...ORGANIZATION_ROLES)
  async joinProgram(@CurrentUser() currentUser: USER, @Body() dto: JoinProgramDto) {
    const data = await this.affiliatesService.joinProgram(currentUser, dto);
    return data;
  }

  // GET /med-alliance/affiliates/me — Get own profile.
  @Get('affiliates/me')
  @HttpCode(200)
  @Roles(...ORGANIZATION_ROLES, ...AFFILIATE_ROLES)
  async findOwn(@CurrentUser() user: USER) {
    const data = await this.affiliatesService.findOwn(user);
    return { status: 200, message: 'Affiliate profile retrieved successfully', data };
  }

  // GET /med-alliance/affiliates/me/stats — Earnings & recent commissions for affiliate dashboard.
  @Get('affiliates/me/stats')
  @HttpCode(200)
  @Roles(...AFFILIATE_ROLES, ...ORGANIZATION_ROLES)
  async getMyStats(@CurrentUser() user: USER) {
    const data = await this.affiliatesService.getMyStats(user);
    return { status: 200, message: 'Affiliate stats retrieved successfully', data };
  }

  // PATCH /med-alliance/affiliates/me — Update own payout preferences only.
  @Patch('affiliates/me')
  @HttpCode(200)
  @Roles(...ORGANIZATION_ROLES, ...AFFILIATE_ROLES)
  async updateOwn(
    @CurrentUser() user: USER,
    @Body() dto: UpdateAffiliatePayoutPreferencesDto,
  ) {
    const data = await this.affiliatesService.updateOwn(user, dto);
    return { status: 200, message: 'Payout preferences updated successfully', data };
  }
}
