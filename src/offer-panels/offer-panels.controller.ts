import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import {
  OfferPanelRecipientType,
  OfferPanelStatus,
  USER,
} from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { OfferPanelsService } from './offer-panels.service';
import { QueryOfferPanelsDto } from './dto/query-offer-panels.dto';
import { CreateOfferPanelDto } from './dto/create-offer-panel.dto';
import { UpdateOfferPanelDto } from './dto/update-offer-panel.dto';

@ApiTags('Offer Panels')
@ApiBearerAuth()
@Controller()
export class OfferPanelsController {
  constructor(private readonly offerPanelsService: OfferPanelsService) {}

  @Post('offer-panels')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create offer panels with fan-out (admin)' })
  @ApiResponse({
    status: 201,
    description:
      'One OfferPanel per recipient created. Returns array of created panels.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — details in response body',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() dto: CreateOfferPanelDto, @CurrentUser() user: USER) {
    const data = await this.offerPanelsService.create(dto, user);
    return { status: 201, data };
  }

  // Static segment — must be declared BEFORE :id
  @Get('offer-panels/contacts/search')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search users and contacts for recipient picker (admin)',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search term (name or email)',
  })
  @ApiQuery({
    name: 'business_unit',
    required: true,
    type: String,
    description:
      'Business unit hubspot_value to filter results (data-driven — any ' +
      'currently visible business unit, e.g. "MedVirtual", "Berry Virtual", "MMVA")',
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns up to 20 results with recipient_type pre-set (client_user or company_contact)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async searchContacts(
    @Query('q') q: string,
    @Query('business_unit') businessUnit: string,
  ) {
    const data = await this.offerPanelsService.searchContacts(
      q ?? '',
      businessUnit,
    );
    return { status: 200, data };
  }

  @Get('offer-panels')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all offer panels (admin)' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: OfferPanelStatus })
  @ApiQuery({
    name: 'recipient_type',
    required: false,
    enum: OfferPanelRecipientType,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Panels retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(@Query() query: QueryOfferPanelsDto) {
    const result = await this.offerPanelsService.findAll(query);
    return {
      status: 200,
      data: result.data,
      pagination: result.pagination,
    };
  }

  // Static segments declared BEFORE :id to avoid route conflicts
  @Get('offer-panels/mine')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('organization_admin', 'organization_super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List the authenticated client's offer panels" })
  @ApiResponse({ status: 200, description: 'Panels retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findMine(@CurrentUser() user: USER) {
    const data = await this.offerPanelsService.findForClientUser(user);
    return {
      status: 200,
      data,
    };
  }

  @Get('offer-panels/by-candidate/:candidateId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List offer panels that include a given candidate (admin)',
  })
  @ApiParam({ name: 'candidateId', type: String, description: 'Candidate ID' })
  @ApiResponse({
    status: 200,
    description: 'Offer panels retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findByCandidateId(@Param('candidateId') candidateId: string) {
    const data = await this.offerPanelsService.findByCandidateId(candidateId);
    return data;
  }

  @Get('offer-panels/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    'system_admin',
    'system_super_admin',
    'organization_admin',
    'organization_super_admin',
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get offer panel by ID with full candidate card data (admin/client)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Offer panel ID' })
  @ApiResponse({
    status: 200,
    description:
      'Returns the offer panel with title, description, status, recipient info, business_unit, and candidates in card shape (same fields as /candidates/talent-pool/:id)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Offer panel not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: USER) {
    const panel = await this.offerPanelsService.findOne(id, user);
    return {
      status: 200,
      data: panel,
    };
  }

  // Task 4.1 — track view (client auth, R17)
  @Post('offer-panels/:id/viewed')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('organization_admin', 'organization_super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track that the client viewed an offer panel (R17)',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'View tracked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Offer panel not found' })
  async trackView(@Param('id') id: string, @CurrentUser() user: USER) {
    await this.offerPanelsService.trackView(id, user);
    return { status: 200 };
  }

  // Task 4.2 — remove candidate from offer (client, R7/R8)
  @Delete('offer-panels/:id/candidates/:candidateId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('organization_admin', 'organization_super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Remove a candidate from the offer panel (R7). Deletes panel if last candidate removed (R8).',
  })
  @ApiParam({ name: 'id', type: String, description: 'Offer panel ID' })
  @ApiParam({
    name: 'candidateId',
    type: String,
    description: 'Candidate ID to remove',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ deleted: true } when panel deleted (R8); { deleted: false, panel } otherwise',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot modify a decided offer panel',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 404,
    description: 'Offer panel or candidate not found',
  })
  async removeCandidate(
    @Param('id') id: string,
    @Param('candidateId') candidateId: string,
    @CurrentUser() user: USER,
  ) {
    const result = await this.offerPanelsService.removeCandidate(
      id,
      candidateId,
      user,
    );
    return { status: 200, data: result };
  }

  // Task 4.3 — decline (client, R6/R12)
  @Post('offer-panels/:id/decline')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('organization_admin', 'organization_super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Decline an offer panel (R6). Notifies the admin (R12). Idempotent.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Declined successfully' })
  @ApiResponse({ status: 400, description: 'Cannot decline an accepted panel' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Offer panel not found' })
  async decline(@Param('id') id: string, @CurrentUser() user: USER) {
    await this.offerPanelsService.decline(id, user);
    return { status: 200 };
  }

  // Task 4.4 — accept (client, R4/R11/R12)
  @Post('offer-panels/:id/accept')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('organization_admin', 'organization_super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Accept offer panel → creates HireRequest in panel_ready (R4/R11). Notifies admin (R12). Idempotent.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Accepted. Returns the created HireRequest.',
  })
  @ApiResponse({ status: 400, description: 'Cannot accept a declined panel' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Offer panel not found' })
  async accept(@Param('id') id: string, @CurrentUser() user: USER) {
    const data = await this.offerPanelsService.acceptByClientUser(id, user);
    return { status: 200, data };
  }

  // Task 4.6 — admin edit
  @Patch('offer-panels/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update offer panel title/description (admin)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Offer panel not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateOfferPanelDto) {
    const data = await this.offerPanelsService.update(id, dto);
    return { status: 200, data };
  }

  // Task 4.7 — admin delete
  @Delete('offer-panels/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Hard delete an offer panel (admin). No recipient notification.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Offer panel not found' })
  async remove(@Param('id') id: string) {
    await this.offerPanelsService.remove(id);
  }
}
