import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  Put,
  Param,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiParam,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { USER } from '@prisma/client';

import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

import { CurrentUser } from '../auth/current-user.decorator';
import { CreateBonusDto } from './dto/create-bonus.dto';
import { terminateDto } from './dto/terminate.dto';

@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({
    summary: 'Create staff',
    description:
      'Create a new staff record. Accessible only by system_super_admin and system_admin roles.',
  })
  @ApiBody({ type: CreateStaffDto })
  @ApiResponse({
    status: 201,
    description: 'The staff has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Failed to create staff.' })
  async create(
    @Body() createStaffDto: CreateStaffDto,
    @CurrentUser() user: USER,
  ) {
    const result = await this.staffService.create(createStaffDto, user);
    return {
      status: 201,
      message: 'Staff created successfully',
      data: result,
    };
  }

  @Post('bonus')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Add bonus to staff',
    description: 'Add bonus to a staff member.',
  })
  @ApiBody({ type: CreateBonusDto })
  @ApiResponse({
    status: 201,
    description: 'The bonus has been successfully added',
  })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot add bonus to inactive staff member',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async addBonus(@Body() data: CreateBonusDto, @CurrentUser() user: USER) {
    const result = await this.staffService.addBonus(data, user);
    return {
      status: 201,
      message: 'The bonus has been successfully added',
      data: result,
    };
  }

  @Post('termination')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Termination with the staff member',
    description: 'terminate the bond with the staff member',
  })
  @ApiBody({ type: terminateDto })
  @ApiResponse({
    status: 201,
    description: 'The termination has been successfully created',
  })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async requestTermination(
    @Body() data: terminateDto,
    @CurrentUser() user: USER,
  ) {
    const result = await this.staffService.requestTermination(data, user);
    return {
      status: 201,
      message: 'The termination has been successfully created',
      data: result,
    };
  }

  @Get('search')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ summary: 'Search staff members', description: 'Search staff by candidate name, email, deal name or hire request title' })
  @ApiResponse({ status: 200, description: 'Staff found successfully.' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term for candidate name, email, deal name or hire request title' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by staff status' })
  @ApiQuery({ name: 'organization_id', required: false, type: String, description: 'Filter by organization ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results to return' })
  async searchStaff(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('organization_id') organization_id?: string,
    @Query('limit') limit?: number,
  ) {
    return this.staffService.searchStaff({ search, status, organization_id, limit });
  }

  @Get('for-tickets')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get staff members for ticket creation',
    description: 'Get a simplified list of staff members for creating tickets',
  })
  @ApiResponse({
    status: 200,
    description: 'Staff members retrieved successfully',
  })
  async getStaffForTickets(@CurrentUser() user: USER) {
    const result = await this.staffService.getStaffForTickets(user);
    return {
      status: 200,
      message: 'Staff members retrieved successfully',
      data: result,
    };
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get all staff records',
    description:
      'Retrieve all staff records. Accessible only by system_super_admin and system_admin roles.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination (default is 1)',
  })
  @ApiQuery({
    name: 'perPage',
    required: false,
    type: Number,
    description: 'Number of records per page for pagination (default is 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Role title',
  })
  @ApiQuery({
    name: 'start_date_from',
    required: false,
    type: Date,
    description: 'Start Date from',
  })
  @ApiQuery({
    name: 'start_date_to',
    required: false,
    type: Date,
    description: 'Start Date to',
  })
  async findAll(
    @Query('page') page: number,
    @Query('perPage') perPage: number,
    @Query('search') search: string,
    @Query('start_date_from') start_date_from: Date,
    @Query('start_date_to') start_date_to: Date,
    @CurrentUser() user: USER,
  ) {
    return await this.staffService.findAll(
      user,
      page,
      perPage,
      search,
      start_date_from,
      start_date_to,
    );
  }

  @Get('by-organization/:organizationId')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get staff records by organization',
    description:
      'Retrieve staff records by an organization.',
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    type: String,
    description: 'Organization ID to filter staff records',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination (default is 1)',
  })
  @ApiQuery({
    name: 'perPage',
    required: false,
    type: Number,
    description: 'Number of records per page for pagination (default is 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Role title',
  })
  @ApiQuery({
    name: 'start_date_from',
    required: false,
    type: Date,
    description: 'Start Date from',
  })
  @ApiQuery({
    name: 'start_date_to',
    required: false,
    type: Date,
    description: 'Start Date to',
  })
  async findByOrganization(
    @Param('organizationId') organizationId: string,
    @Query('page') page: number,
    @Query('perPage') perPage: number,
    @Query('search') search: string,
    @Query('start_date_from') start_date_from: Date,
    @Query('start_date_to') start_date_to: Date,
    @CurrentUser() user: USER,
  ) {
    return await this.staffService.findByOrganization(
      user,
      organizationId,
      page,
      perPage,
      search,
      start_date_from,
      start_date_to,
    );
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({
    summary: 'Update staff member',
    description:
      'Update staff member details, candidate information, and skills. Accessible only by system_super_admin and system_admin roles.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: String,
    description: 'Staff member ID',
  })
  @ApiBody({ type: UpdateStaffDto })
  @ApiResponse({
    status: 200,
    description: 'Staff member updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  @ApiResponse({ status: 400, description: 'Failed to update staff member' })
  async updateStaff(
    @Param('id') staffId: string,
    @Body() updateStaffDto: UpdateStaffDto,
    @CurrentUser() user: USER,
  ) {
    const result = await this.staffService.updateStaff(
      staffId,
      updateStaffDto,
      user,
    );
    return result;
  }

  @Get('populate-db/from-hubspot')
  @ApiOperation({ summary: "Populate DB", description: 'Populate DB with organizations from hubspot' })
  async populateDbFromHubspot() {
    return await this.staffService.populateDbFromHubspot();
  }

  //This action is to used manually when we need to sync the organization ids for the staffs that were created before we implemented the relation between staff and organization
  @Get('sync/organization-ids')
  
  @ApiOperation({
    summary: 'Sync organization IDs',
    description: 'For each staff with hubspot_organization_id but no organization_id, finds the matching Organization and updates the relation.',
  })
  @ApiResponse({ status: 200, description: 'Sync completed successfully' })
  async syncOrganizationIds() {
    return await this.staffService.syncOrganizationIds();
  }


  @Get('back-to-active/:id')
  @UseGuards(AuthGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiParam({ name: 'id', required: true, type: String, description: 'Staff member ID' })
  @ApiOperation({ summary: "Back to active", description: 'Move staff from termination-requested to active' })
  @ApiResponse({ status: 200, description: 'Staff member moved back to active successfully' })
  @ApiResponse({ status: 400, description: 'Staff ID is required' })
  @ApiResponse({ status: 404, description: 'Staff member not found or not in termination-requested status' })
  @ApiResponse({ status: 400, description: 'Failed to move staff member back to active' })
  
  async moveStaffBackToActive(@Param('id') staffId: string) {
    const result = await this.staffService.moveStaffBackToActive(staffId);
    return {
      status: 200,
      message: 'Staff member moved back to active successfully',
      data: result,
    };
  }
}
