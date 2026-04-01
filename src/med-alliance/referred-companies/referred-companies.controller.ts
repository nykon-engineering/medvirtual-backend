import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
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
  @Roles(...AFFILIATE_ROLES)
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
  async findAllAdmin(@Query() query: ListReferredCompaniesDto) {
    const result = await this.service.findAllForAdmin(query);
    return { status: 200, message: 'Referred companies retrieved successfully', ...result };
  }

  // GET /med-alliance/admin/referred-companies/:id — Get one (no scoping).
  @Get('admin/referred-companies/:id')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findOneAdmin(@Param('id') id: string) {
    const data = await this.service.findOneForAdmin(id);
    return { status: 200, message: 'Referred company retrieved successfully', data };
  }

  // POST /med-alliance/admin/referred-companies/:id/eligibility-check
  // Re-runs the MA-004 active-client check for an existing referral.
  @Post('admin/referred-companies/:id/eligibility-check')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
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
  async sync(@Param('id') id: string) {
    const data = await this.referralSync.run(id);
    return { status: 200, message: 'Sync completed', data };
  }
}
