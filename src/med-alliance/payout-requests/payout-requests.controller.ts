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
import { PayoutRequestsService } from './payout-requests.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { ADMIN_ROLES, AFFILIATE_ROLES } from '../constants';
import { CreatePayoutRequestDto } from './dto/create-payout-request.dto';
import {
  DecidePayoutRequestDto,
  MarkPayoutPaidDto,
} from './dto/decide-payout-request.dto';
import { ListPayoutRequestsDto } from './dto/list-payout-requests.dto';

@Controller('med-alliance')
@UseGuards(AuthGuard, RolesGuard)
export class PayoutRequestsController {
  constructor(private readonly payoutRequestsService: PayoutRequestsService) {}

  // ---------------------------------------------------------------------------
  // Affiliate routes
  // ---------------------------------------------------------------------------

  // POST /med-alliance/payout-requests — Submit a new payout request.
  @Post('payout-requests')
  @HttpCode(201)
  @Roles(...AFFILIATE_ROLES)
  async create(
    @Body() dto: CreatePayoutRequestDto,
    @CurrentUser() user: USER,
  ) {
    const data = await this.payoutRequestsService.create(dto, user);
    return { status: 201, message: 'Payout request submitted successfully', data };
  }

  // GET /med-alliance/payout-requests — List own payout requests.
  @Get('payout-requests')
  @HttpCode(200)
  @Roles(...AFFILIATE_ROLES)
  async findAll(
    @Query() query: ListPayoutRequestsDto,
    @CurrentUser() user: USER,
  ) {
    const result = await this.payoutRequestsService.findAllForAffiliate(query, user);
    return { status: 200, message: 'Payout requests retrieved successfully', ...result };
  }

  // GET /med-alliance/payout-requests/:id — Get one (scoped to affiliate).
  @Get('payout-requests/:id')
  @HttpCode(200)
  @Roles(...AFFILIATE_ROLES)
  async findOne(@Param('id') id: string, @CurrentUser() user: USER) {
    const data = await this.payoutRequestsService.findOneForAffiliate(id, user);
    return { status: 200, message: 'Payout request retrieved successfully', data };
  }

  // ---------------------------------------------------------------------------
  // Admin routes
  // ---------------------------------------------------------------------------

  // GET /med-alliance/admin/payout-requests — List all payout requests.
  @Get('admin/payout-requests')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findAllAdmin(@Query() query: ListPayoutRequestsDto) {
    const result = await this.payoutRequestsService.findAllForAdmin(query);
    return { status: 200, message: 'Payout requests retrieved successfully', ...result };
  }

  // GET /med-alliance/admin/payout-requests/:id — Get one with full details.
  @Get('admin/payout-requests/:id')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async findOneAdmin(@Param('id') id: string) {
    const data = await this.payoutRequestsService.findOneForAdmin(id);
    return { status: 200, message: 'Payout request retrieved successfully', data };
  }

  // PATCH /med-alliance/admin/payout-requests/:id/decide — Approve or reject.
  @Patch('admin/payout-requests/:id/decide')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async decide(
    @Param('id') id: string,
    @Body() dto: DecidePayoutRequestDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.payoutRequestsService.decide(id, dto, admin);
    return { status: 200, message: 'Payout request decision recorded successfully', data };
  }

  // PATCH /med-alliance/admin/payout-requests/:id/paid — Mark as paid.
  @Patch('admin/payout-requests/:id/paid')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async markPaid(
    @Param('id') id: string,
    @Body() dto: MarkPayoutPaidDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.payoutRequestsService.markPaid(id, dto, admin);
    return { status: 200, message: 'Payout request marked as paid', data };
  }

  // GET /med-alliance/admin/payout-requests/:id/audit — Full audit timeline.
  @Get('admin/payout-requests/:id/audit')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async getAuditLog(@Param('id') id: string) {
    const data = await this.payoutRequestsService.getAuditLog(id);
    return { status: 200, message: 'Audit log retrieved successfully', data };
  }
}
