import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { ADMIN_ROLES, AFFILIATE_ROLES, ORGANIZATION_ROLES } from '../constants';
import { ListCommissionsDto } from './dto/list-commissions.dto';
import { DecideCommissionDto, VoidCommissionDto, ReinstateCommissionDto, UnvoidCommissionDto, UpdateBaseAmountDto } from './dto/decide-commission.dto';

@Controller('med-alliance')
@UseGuards(AuthGuard, RolesGuard)
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  // ---------------------------------------------------------------------------
  // Affiliate routes
  // ---------------------------------------------------------------------------

  // GET /med-alliance/commissions — List own commissions.
  @Get('commissions')
  @HttpCode(200)
  @Roles(...AFFILIATE_ROLES, ...ORGANIZATION_ROLES)
  async findAll(@Query() query: ListCommissionsDto, @CurrentUser() user: USER) {
    const result = await this.commissionsService.findAllForAffiliate(query, user);
    return { status: 200, message: 'Commissions retrieved successfully', ...result };
  }

  // GET /med-alliance/commissions/:id — Get one commission (scoped).
  @Get('commissions/:id')
  @HttpCode(200)
  @Roles(...ORGANIZATION_ROLES)
  async findOne(@Param('id') id: string, @CurrentUser() user: USER) {
    const data = await this.commissionsService.findOneForAffiliate(id, user);
    return { status: 200, message: 'Commission retrieved successfully', data };
  }

  // ---------------------------------------------------------------------------
  // Admin routes
  // ---------------------------------------------------------------------------

  // GET /med-alliance/admin/commissions — List all commissions.
  @Get('admin/commissions')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findAllAdmin(@Query() query: ListCommissionsDto) {
    const result = await this.commissionsService.findAllForAdmin(query);
    return { status: 200, message: 'Commissions retrieved successfully', ...result };
  }

  // GET /med-alliance/admin/commissions/:id — Get one commission with full details.
  @Get('admin/commissions/:id')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findOneAdmin(@Param('id') id: string) {
    const data = await this.commissionsService.findOneForAdmin(id);
    return { status: 200, message: 'Commission retrieved successfully', data };
  }

  // PATCH /med-alliance/admin/commissions/:id/decide — Approve or reject.
  @Patch('admin/commissions/:id/decide')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async decide(
    @Param('id') id: string,
    @Body() dto: DecideCommissionDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.commissionsService.decide(id, dto, admin);
    return { status: 200, message: 'Commission decision recorded successfully', data };
  }

  // PATCH /med-alliance/admin/commissions/:id/void — Void a commission.
  @Patch('admin/commissions/:id/void')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async void(
    @Param('id') id: string,
    @Body() dto: VoidCommissionDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.commissionsService.void(id, dto, admin);
    return { status: 200, message: 'Commission voided successfully', data };
  }

  // PATCH /med-alliance/admin/commissions/:id/revert-to-detected — Revert eligible → detected.
  @Patch('admin/commissions/:id/revert-to-detected')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async revertToDetected(@Param('id') id: string, @CurrentUser() admin: USER) {
    const data = await this.commissionsService.revertToDetected(id, admin);
    return { status: 200, message: 'Commission reverted to detected', data };
  }

  // PATCH /med-alliance/admin/commissions/:id/unvoid — Unvoid void → detected.
  @Patch('admin/commissions/:id/unvoid')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async unvoid(
    @Param('id') id: string,
    @Body() dto: UnvoidCommissionDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.commissionsService.unvoid(id, dto, admin);
    return { status: 200, message: 'Commission unvoided to detected', data };
  }

  // PATCH /med-alliance/admin/commissions/:id/reinstate — Reinstate rejected → eligible.
  @Patch('admin/commissions/:id/reinstate')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async reinstate(
    @Param('id') id: string,
    @Body() dto: ReinstateCommissionDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.commissionsService.reinstate(id, dto, admin);
    return { status: 200, message: 'Commission reinstated to eligible', data };
  }

  // PATCH /med-alliance/admin/commissions/:id/update-base-amount — Update base amount (detected only).
  @Patch('admin/commissions/:id/update-base-amount')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async updateBaseAmount(
    @Param('id') id: string,
    @Body() dto: UpdateBaseAmountDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.commissionsService.updateBaseAmount(id, dto, admin);
    return { status: 200, message: 'Commission base amount updated successfully', data };
  }

  // GET /med-alliance/admin/commissions/:id/audit — Full audit timeline.
  @Get('admin/commissions/:id/audit')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async getAuditLog(@Param('id') id: string) {
    const data = await this.commissionsService.getAuditLog(id);
    return { status: 200, message: 'Audit log retrieved successfully', data };
  }
}
