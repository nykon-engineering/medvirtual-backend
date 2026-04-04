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
import { ADMIN_ROLES, ORGANIZATION_ROLES } from '../constants';
import { CreateAffiliateProfileDto } from './dto/create-affiliate-profile.dto';
import {
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
    return { status: 201, message: 'Affiliate profile created successfully', data };
  }

  // GET /med-alliance/admin/affiliates — List all affiliate profiles.
  @Get('admin/affiliates')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findAll(@Query() query: ListAffiliatesDto) {
    const result = await this.affiliatesService.findAll(query);
    return { status: 200, message: 'Affiliate profiles retrieved successfully', ...result };
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

  // ---------------------------------------------------------------------------
  // Affiliate routes
  // ---------------------------------------------------------------------------

  // GET /med-alliance/affiliates/me — Get own profile.
  @Get('affiliates/me')
  @HttpCode(200)
  @Roles(...ORGANIZATION_ROLES)
  async findOwn(@CurrentUser() user: USER) {
    const data = await this.affiliatesService.findOwn(user);
    return { status: 200, message: 'Affiliate profile retrieved successfully', data };
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
