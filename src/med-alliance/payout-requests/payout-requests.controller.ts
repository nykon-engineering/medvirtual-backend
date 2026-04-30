import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { ADMIN_ROLES, AFFILIATE_ROLES, ORGANIZATION_ROLES } from '../constants';
import { AdminCreatePayoutRequestDto, CreatePayoutRequestDto } from './dto/create-payout-request.dto';
import {
  AddPayoutNoteDto,
  CancelPayoutRequestDto,
  DecidePayoutRequestDto,
  MarkPayoutPaidDto,
  UpdatePayoutNoteDto,
} from './dto/decide-payout-request.dto';
import { ReopenPayoutRequestDto } from './dto/reopen-payout-request.dto';
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
  @Roles(...ORGANIZATION_ROLES, ...AFFILIATE_ROLES)
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
  @Roles(...AFFILIATE_ROLES, ...ORGANIZATION_ROLES)
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
  //@Roles(...ADMIN_ROLES)
  async findOne(@Param('id') id: string, @CurrentUser() user: USER) {
    const data = await this.payoutRequestsService.findOneForAffiliate(id, user);
    return { status: 200, message: 'Payout request retrieved successfully', data };
  }

  // ---------------------------------------------------------------------------
  // Admin routes
  // ---------------------------------------------------------------------------

  // POST /med-alliance/admin/payout-requests — Admin creates a payout request on behalf of an affiliate.
  @Post('admin/payout-requests')
  @HttpCode(201)
  @Roles(...ADMIN_ROLES)
  async createForAdmin(
    @Body() dto: AdminCreatePayoutRequestDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.payoutRequestsService.createForAdmin(dto, admin);
    return { status: 201, message: 'Payout request created successfully', data };
  }

  // B7: GET /med-alliance/admin/payout-requests/counts — Status counters for kanban.
  // NOTE: must be declared BEFORE /:id to avoid route conflict.
  @Get('admin/payout-requests/counts')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async getStatusCounts() {
    const data = await this.payoutRequestsService.getStatusCounts();
    return { status: 200, message: 'Status counts retrieved successfully', data };
  }

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

  // B1: PATCH /med-alliance/admin/payout-requests/:id/start-review
  // Transition: requested → under_review
  @Patch('admin/payout-requests/:id/start-review')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async startReview(
    @Param('id') id: string,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.payoutRequestsService.startReview(id, admin);
    return { status: 200, message: 'Payout request moved to under review', data };
  }

  // PATCH /med-alliance/admin/payout-requests/:id/decide — Approve or reject.
  // Allowed from: requested | under_review
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

  // B2: PATCH /med-alliance/admin/payout-requests/:id/paid — Mark as paid.
  // Allowed from: under_review | approved
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

  // POST /med-alliance/admin/payout-requests/:id/cancel — Cancel a payout request.
  // Allowed from: requested | under_review
  @Post('admin/payout-requests/:id/cancel')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelPayoutRequestDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.payoutRequestsService.cancelPayoutRequest(id, dto, admin);
    return { status: 200, message: 'Payout request cancelled successfully', data };
  }

  // PATCH /med-alliance/admin/payout-requests/:id/reopen — Reopen to a previous status.
  // Allowed: under_review → requested | rejected → requested | rejected → under_review
  @Patch('admin/payout-requests/:id/reopen')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async reopen(
    @Param('id') id: string,
    @Body() dto: ReopenPayoutRequestDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.payoutRequestsService.reopen(id, dto.target_status, admin);
    return { status: 200, message: 'Payout request reopened successfully', data };
  }

  // B3: POST /med-alliance/admin/payout-requests/:id/notes — Add a note.
  @Post('admin/payout-requests/:id/notes')
  @HttpCode(201)
  @Roles(...ADMIN_ROLES)
  async addNote(
    @Param('id') id: string,
    @Body() dto: AddPayoutNoteDto,
    @CurrentUser() admin: USER,
  ) {
    const data = await this.payoutRequestsService.addNote(id, dto, admin);
    return { status: 201, message: 'Note added successfully', data };
  }

  // B3: GET /med-alliance/admin/payout-requests/:id/notes — List notes.
  @Get('admin/payout-requests/:id/notes')
  @HttpCode(200)
  @Roles(...ADMIN_ROLES)
  async getNotes(@Param('id') id: string) {
    const data = await this.payoutRequestsService.getNotes(id);
    return { status: 200, message: 'Notes retrieved successfully', data };
  }

  // B3: PATCH /med-alliance/admin/payout-requests/:id/notes/:noteId — Update a note.
  @Patch('admin/payout-requests/:id/notes/:noteId')
  @HttpCode(HttpStatus.OK)
  @Roles(...ADMIN_ROLES)
  async updateNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdatePayoutNoteDto,
  ) {
    const data = await this.payoutRequestsService.updateNote(id, noteId, dto);
    return { status: 200, message: 'Note updated successfully', data };
  }

  // B3: DELETE /med-alliance/admin/payout-requests/:id/notes/:noteId — Delete a note.
  @Delete('admin/payout-requests/:id/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ADMIN_ROLES)
  async deleteNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ) {
    await this.payoutRequestsService.deleteNote(id, noteId);
  }

  // B3: GET /med-alliance/admin/payout-requests/:id/notes — List notes for Affiliates.
  @Get('payout-requests/:id/notes')
  @HttpCode(200)
  @Roles(...AFFILIATE_ROLES, ...ORGANIZATION_ROLES)
  async getNotesForAffiliates(@Param('id') id: string) {
    const data = await this.payoutRequestsService.getNotesForAffiliates(id);
    return { status: 200, message: 'Notes retrieved successfully', data };
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
