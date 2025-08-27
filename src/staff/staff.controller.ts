import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { USER } from '@prisma/client';

import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';

import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

import { CurrentUser } from '../auth/current-user.decorator';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ summary: 'Create staff', description: 'Create a new staff record. Accessible only by system_super_admin and system_admin roles.' })
  @ApiBody({ type: CreateStaffDto })
  @ApiResponse({ status: 201, description: 'The staff has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Failed to create staff.' })
  async create(@Body() createStaffDto: CreateStaffDto, @CurrentUser() user: USER) {
    const result = await this.staffService.create(createStaffDto, user);
    return {
      status: 201,
      message: 'Staff created successfully',
      data: result
    }
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get all staff records', description: 'Retrieve all staff records. Accessible only by system_super_admin and system_admin roles.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination (default is 1)' })
  @ApiQuery({ name: 'perPage', required: false, type: Number, description: 'Number of records per page for pagination (default is 10)' })
  async findAll(@Query('page') page: number, @Query('perPage') perPage: number, @CurrentUser() user: USER) {
    return await this.staffService.findAll(user, page, perPage);
  }

}
