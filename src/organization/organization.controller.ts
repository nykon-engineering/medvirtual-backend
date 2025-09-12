import {
  Body,
  Controller,
  Post,
  Put,
  Param,
  HttpCode,
  Get,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/createOrganization.dto';
import { UpdateOrganizationDto } from './dto/updateOrganization.dto';
import { ConvertToClientDto } from './dto/convertToClient.dto';
import { GetOrganizationsDto } from './dto/getOrganizations.dto';
import { PaginatedOrganizationsResponseDto } from './dto/organizationResponse.dto';
import {
  GetOrganizationStaffDto,
  AdminCreateStaffDto,
} from './dto/admin-staff-management.dto';

import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { USER } from '@prisma/client';

@ApiTags('Organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('hubspot')
  @ApiProperty({ description: 'Get all organizations from hubspot' })
  async getfromHubspot() {
    return await this.organizationService.getAllFromHubspot();
  }
  //========== // =========

  @Get('')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all organizations' })
  @ApiResponse({
    status: 200,
    description: 'List of organizations retrieved successfully',
  })
  async getAll(@CurrentUser() user: USER) {
    return await this.organizationService.getAll(user);
  }

  @Get('paginated')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    'system_super_admin',
    'system_admin',
    'organization_admin',
    'organization_super_admin',
  )
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get organizations with pagination, filtering, and search',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of organizations retrieved successfully',
    type: PaginatedOrganizationsResponseDto,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 100)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term for name, email, or description',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['prospect', 'client'],
    description: 'Filter by organization role',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive'],
    description: 'Filter by organization status',
  })
  @ApiQuery({
    name: 'industry',
    required: false,
    type: String,
    description: 'Filter by industry',
  })
  @ApiQuery({
    name: 'location',
    required: false,
    type: String,
    description: 'Filter by location',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'email', 'createdAt', 'updatedAt', 'number_of_employees'],
    description: 'Sort field (default: createdAt)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order (default: desc)',
  })
  async getAllPaginated(
    @CurrentUser() user: USER,
    @Query() query: GetOrganizationsDto,
  ): Promise<PaginatedOrganizationsResponseDto> {
    return await this.organizationService.getAllPaginated(user, query);
  }

  @Get('/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    'system_admin',
    'system_super_admin',
    'organization_admin',
    'organization_super_admin',
  )
  @HttpCode(200)
  @ApiOperation({ summary: 'Get organization by Id' })
  @ApiResponse({
    status: 200,
    description: 'Organization retrieved successfully',
  })
  async getById(@Param('id') id: string) {
    return await this.organizationService.getById(id);
  }

  @Post('create')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @HttpCode(201)
  @ApiBody({ type: CreateOrganizationDto })
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
  })
  async create(@Body() data: CreateOrganizationDto, @CurrentUser() user: any) {
    const org = await this.organizationService.create(data, user);
    return {
      status: 201,
      message: 'Organization created successfully',
      organization: org,
    };
  }

  @Put('edit/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    'system_admin',
    'system_super_admin',
    'organization_admin',
    'organization_super_admin',
  )
  @HttpCode(200)
  @ApiBody({ type: UpdateOrganizationDto })
  @ApiOperation({ summary: 'Edit organization info' })
  @ApiResponse({
    status: 200,
    description: 'Organization updated successfully',
  })
  async update(@Param('id') id: string, @Body() data: UpdateOrganizationDto) {
    const org = await this.organizationService.update(id, data);
    return {
      status: 200,
      message: 'Organization updated successfully',
      organization: org,
    };
  }

  @Post('convert-to-client/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    'system_admin',
    'system_super_admin',
    'organization_admin',
    'organization_super_admin',
  )
  @HttpCode(200)
  @ApiBody({ type: ConvertToClientDto })
  @ApiOperation({ summary: 'Convert organization from prospect to client' })
  @ApiResponse({
    status: 200,
    description: 'Organization converted to client successfully',
  })
  async convertToClient(
    @Param('id') id: string,
    @Body() data: ConvertToClientDto,
  ) {
    const org = await this.organizationService.convertToClient(id, data);
    return {
      status: 200,
      message: 'Organization converted to client successfully',
      organization: org,
    };
  }

  @Put('assign-concierge/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Assign a concierge to an organization' })
  @ApiResponse({
    status: 200,
    description: 'Concierge assigned successfully',
  })
  async assignConcierge(
    @Param('id') id: string,
    @Body('concierge_id') conciergeId: string,
  ) {
    const org = await this.organizationService.assignConcierge(id, conciergeId);
    return {
      status: 200,
      message: 'Concierge assigned successfully',
      organization: org,
    };
  }

  // @Post('delete/:id')
  // @UseGuards(AuthGuard, RolesGuard)
  // @Roles('system_super_admin')
  // @HttpCode(200)
  // @ApiOperation({ summary: 'Delete organization' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Organization deleted successfully',
  // })
  // async delete(@Param('id') id: string) {
  //   await this.organizationService.delete(id);
  //   return {
  //     status: 200,
  //     message: 'Organization deleted successfully',
  //   };
  // }

  // Admin Staff Management Endpoints
  @Get(':id/staff')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get staff for a specific organization',
    description:
      'Allows system admins to view all staff members for any organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization staff retrieved successfully',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'perPage',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term for staff name or hire request title',
  })
  @ApiQuery({
    name: 'start_date_from',
    required: false,
    type: Date,
    description: 'Filter staff by start date from',
  })
  @ApiQuery({
    name: 'start_date_to',
    required: false,
    type: Date,
    description: 'Filter staff by start date to',
  })
  async getOrganizationStaff(
    @Param('id') organizationId: string,
    @Query() query: GetOrganizationStaffDto,
    @CurrentUser() user: USER,
  ) {
    return await this.organizationService.getOrganizationStaff(
      organizationId,
      query,
      user,
    );
  }

  @Post('staff/create')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create staff for any organization',
    description:
      'Allows system admins to create staff members for any organization',
  })
  @ApiBody({ type: AdminCreateStaffDto })
  @ApiResponse({
    status: 201,
    description: 'Staff created successfully for organization',
  })
  async createStaffForOrganization(
    @Body() data: AdminCreateStaffDto,
    @CurrentUser() user: USER,
  ) {
    return await this.organizationService.createStaffForOrganization(
      data,
      user,
    );
  }
}
