import {
  Controller,
  Get,
  Post,
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
  @ApiResponse({
    status: 200,
    description:
      'Returns up to 20 results with recipient_type pre-set (client_user or company_contact)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async searchContacts(@Query('q') q: string) {
    const data = await this.offerPanelsService.searchContacts(q ?? '');
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
}
