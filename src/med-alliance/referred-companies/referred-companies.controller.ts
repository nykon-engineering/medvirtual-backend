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
import { ReferredCompaniesService } from './referred-companies.service';
import { EligibilityCheckService } from './eligibility-check.service';
import { ReferralSyncService } from '../sync/referral-sync.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { ADMIN_ROLES, AFFILIATE_ROLES, ORGANIZATION_ROLES } from '../constants';
import { CreateReferredCompanyDto } from './dto/create-referred-company.dto';
import { ListReferredCompaniesDto } from './dto/list-referred-companies.dto';
import { UpdateReferralStageDto } from './dto/update-referral-stage.dto';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('med-alliance')
@ApiBearerAuth()
@Controller('med-alliance')
@UseGuards(AuthGuard, RolesGuard)
export class ReferredCompaniesController {
  constructor(
    private readonly service: ReferredCompaniesService,
    private readonly eligibilityCheck: EligibilityCheckService,
    private readonly referralSync: ReferralSyncService,
  ) {}

  // ---------------------------------------------------------------------------
  // Affiliate routes
  // ---------------------------------------------------------------------------

  // POST /med-alliance/referred-companies — Submit a new company referral.
  @Post('referred-companies')
  @HttpCode(201)
  // Any user can submit a referral, because the button on frontend only appears for the correct ones
  //@Roles(...AFFILIATE_ROLES, ...ADMIN_ROLES)
  @ApiOperation({ summary: 'Submit a new company referral to the Med Alliance program' })
  @ApiResponse({ status: 201, description: 'Referred company created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate referral' })
  async create(
    @Body() dto: CreateReferredCompanyDto,
    @CurrentUser() user: USER,
  ) {
    const data = await this.service.create(dto, user);
    return { status: 201, message: 'Referred company created successfully', data };
  }

  // GET /med-alliance/referred-companies — List own referred companies.
  @Get('referred-companies')
  @HttpCode(200)
  @Roles(...AFFILIATE_ROLES, ...ORGANIZATION_ROLES)
  @ApiOperation({ summary: 'List all company referrals submitted by the current affiliate' })
  @ApiResponse({ status: 200, description: 'Referred companies retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied: insufficient permissions' })
  async findAll(
    @Query() query: ListReferredCompaniesDto,
    @CurrentUser() user: USER,
  ) {
    const result = await this.service.findAllForAffiliate(query, user);
    return { status: 200, message: 'Referred companies retrieved successfully', ...result };
  }

  // GET /med-alliance/referred-companies/:id — Get one (scoped to affiliate).
  @Get('referred-companies/:id')
  @HttpCode(200)
  @Roles(...AFFILIATE_ROLES, ...ORGANIZATION_ROLES)
  @ApiOperation({ summary: 'Get details for a single referred company scoped to the current affiliate' })
  @ApiParam({ name: 'id', description: 'Referred company (organization) UUID' })
  @ApiResponse({ status: 200, description: 'Referred company retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Referred company not found or access denied' })
  async findOne(@Param('id') id: string, @CurrentUser() user: USER) {
    const data = await this.service.findOneForAffiliate(id, user);
    return { status: 200, message: 'Referred company retrieved successfully', data };
  }

  // ---------------------------------------------------------------------------
  // Admin routes
  // ---------------------------------------------------------------------------

  // GET /med-alliance/admin/referred-companies — List all referred companies.
  @Get('admin/referred-companies')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'List all referred companies across all affiliates for admin pipeline management' })
  @ApiResponse({ status: 200, description: 'Referred companies retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied: insufficient permissions' })
  async findAllAdmin(@Query() query: ListReferredCompaniesDto) {
    const result = await this.service.findAllForAdmin(query);
    return { status: 200, message: 'Referred companies retrieved successfully', ...result };
  }

  // GET /med-alliance/admin/referred-companies/:id — Get one (no scoping).
  @Get('admin/referred-companies/:id')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Get full details for a single referred company without affiliate scoping' })
  @ApiParam({ name: 'id', description: 'Referred company (organization) UUID' })
  @ApiResponse({ status: 200, description: 'Referred company retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Referred company not found' })
  @ApiResponse({ status: 403, description: 'Access denied: insufficient permissions' })
  async findOneAdmin(@Param('id') id: string) {
    const data = await this.service.findOneForAdmin(id);
    return { status: 200, message: 'Referred company retrieved successfully', data };
  }

  // PATCH /med-alliance/admin/referred-companies/:id/stage — Move company to a new pipeline stage.
  @Patch('admin/referred-companies/:id/stage')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Move a referred company to a new referral pipeline stage' })
  @ApiParam({ name: 'id', description: 'Referred company (organization) UUID' })
  @ApiResponse({ status: 200, description: 'Pipeline stage updated successfully' })
  @ApiResponse({ status: 404, description: 'Referred company not found' })
  @ApiResponse({ status: 403, description: 'Access denied: insufficient permissions' })
  async updateReferralStage(
    @Param('id') id: string,
    @Body() dto: UpdateReferralStageDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.service.updateReferralStage(id, dto, admin);
    return { status: 200, message: 'Pipeline stage updated successfully', data };
  }

  // POST /med-alliance/admin/referred-companies/:id/eligibility-check
  // Re-runs the MA-004 active-client check for an existing referral.
  @Post('admin/referred-companies/:id/eligibility-check')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Re-run the eligibility check for a referred company to verify active client status' })
  @ApiParam({ name: 'id', description: 'Referred company (organization) UUID' })
  @ApiResponse({ status: 200, description: 'Eligibility check completed' })
  @ApiResponse({ status: 404, description: 'Referred company not found' })
  @ApiResponse({ status: 403, description: 'Access denied: insufficient permissions' })
  async recheck(@Param('id') id: string, @CurrentUser() user: USER) {
    const data = await this.eligibilityCheck.runAndPersist(id, user.id, 'admin_action');
    return { status: 200, message: 'Eligibility check completed', data };
  }

  // POST /med-alliance/admin/referred-companies/:id/sync
  // Re-runs the full MA-005 sync pipeline (Phase A + B) for an existing referral.
  // If hubspot_id is already set, Phase A is skipped and only invoices are re-ingested.
  @Post('admin/referred-companies/:id/sync')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Re-run the full sync pipeline for a referred company including HubSpot matching and invoice ingestion' })
  @ApiParam({ name: 'id', description: 'Referred company (organization) UUID' })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  @ApiResponse({ status: 404, description: 'Referred company not found' })
  @ApiResponse({ status: 403, description: 'Access denied: insufficient permissions' })
  async sync(@Param('id') id: string) {
    const data = await this.referralSync.run(id);
    return { status: 200, message: 'Sync completed', data };
  }

  @Get('referred_to/options')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get available options and owners for the referred_to field in company referrals' })
  @ApiResponse({ status: 200, description: 'Referred to options retrieved successfully' })

  async getReferredToOptionsController() {
    const result = await this.service.getReferredToOptions();
    return {
      status: 200,
      message: 'Referred to options retrieved successfully',
      data: result,
    }
  };

}


