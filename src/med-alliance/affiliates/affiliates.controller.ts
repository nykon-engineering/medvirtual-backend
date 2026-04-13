import {
  Body,
  Controller,
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
        banking_complete: !!(profile.payout_preference_method && profile.payout_preference_reference),
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

  // GET /med-alliance/admin/affiliates/by-user/:userId — Get affiliate profile by user ID.
  // Must be declared BEFORE the /:id route so NestJS does not treat "by-user" as an id.
  @Get('admin/affiliates/by-user/:userId')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findByUserId(@Param('userId') userId: string) {
    const data = await this.affiliatesService.findByUserId(userId);
    return { status: 'success', data };
  }

  // GET /med-alliance/admin/affiliates/:id — Get one affiliate profile.
  @Get('admin/affiliates/:id')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findOne(@Param('id') id: string) {
    const data = await this.affiliatesService.findOne(id);
    return { status: 200, message: 'Affiliate profile retrieved successfully', data };
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
  @Roles(...ORGANIZATION_ROLES)
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
  @Roles(...ORGANIZATION_ROLES)
  async updateOwn(
    @CurrentUser() user: USER,
    @Body() dto: UpdateAffiliatePayoutPreferencesDto,
  ) {
    const data = await this.affiliatesService.updateOwn(user, dto);
    return { status: 200, message: 'Payout preferences updated successfully', data };
  }
}
