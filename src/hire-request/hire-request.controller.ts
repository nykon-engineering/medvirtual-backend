import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, HttpCode } from '@nestjs/common';
import { USER } from '@prisma/client';

import { HireRequestService } from './hire-request.service';
import { CreateHireRequestDto } from './dto/create-hire-request.dto';
import { UpdateHireRequestDto } from './dto/update-hire-request.dto';
import { changeStatusHireRequesDTO } from './dto/changeStatus-hire-request.dto';

import { AuthGuard } from '../auth/auth.guard';
import { ApiBody, ApiProperty, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { reassignDTO } from './dto/reassign-hire-request.dto';



@Controller('hire-request')
export class HireRequestController {
  constructor(private readonly hireRequestService: HireRequestService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiProperty({ description: 'Create new hire request' })
  @ApiBody({ type: CreateHireRequestDto })
  @ApiResponse({ status: 200, description: 'Hire request created successfully' })
  async create(@Body() createHireRequestDto: CreateHireRequestDto, @CurrentUser() user: USER): Promise<object> {
    const result = await this.hireRequestService.create(createHireRequestDto, user);
    return {
      status: 201,
      message: result,
    }
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiProperty({ description: 'Get all hire requests regarding rules for the current user' })
  @ApiResponse({ status: 200, description: 'List of hire requests' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'User role not found' })
  @ApiResponse({ status: 404, description: 'No hire requests found for this organization' })
  async findAll(@CurrentUser() user: USER) {
    const result = await this.hireRequestService.findAll(user);
    return {
      status: 200,
      message: 'Data retrieved successfully',
      data: result,
    }
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiProperty({ description: 'Get specific requests regarding rules for the current user' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiResponse({ status: 200, description: 'Hire request found successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.findOne(id, user);
    return {
      status: 200,
      message: 'Hire request found successfully',
      data: result,
    }
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiProperty({ description: 'Update specific requests regarding rules for the current user' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiBody({ type: UpdateHireRequestDto })
  @ApiResponse({ status: 200, description: 'Hire request updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 400, description: 'Hire request not updated' })
  @ApiResponse({ status: 400, description: 'Hire request skills not updated' })
  async update(@Param('id') id: string, @Body() updateHireRequestDto: UpdateHireRequestDto, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.update(id, updateHireRequestDto, user);
    return {
      status: 200,
      message: 'Hire request updated successfully',
      data: result,
    }
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'organization_super_admin')
  @ApiProperty({ description: 'Delete specific requests regarding rules for the current user' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiResponse({ status: 200, description: 'Hire request deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  @ApiResponse({ status: 400, description: 'Hire request not deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.remove(id, user);
    return {
      status: 200,
      message: 'Hire request deleted successfully',
      data: result,
    }
  }

  @Patch('change-status/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'organization_super_admin')
  @ApiProperty({ description: 'Update status of specific hire request' })
  @ApiQuery({ name: 'id', required: true, description: 'Hire request ID' })
  @ApiBody({ type: changeStatusHireRequesDTO })
  @ApiResponse({ status: 200, description: 'Hire request status updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 400, description: 'Data for status change is required' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  @ApiResponse({ status: 400, description: 'Hire request status not updated' })
  @ApiResponse({ status: 400, description: 'Status change from XXXX to XXXXX is not allowed' })
  async updateStatus(@Param('id') id: string, @Body() data: changeStatusHireRequesDTO, @CurrentUser() user: USER) {
    const result = await this.hireRequestService.updateStatus(id, data, user);
    return {
      status: 200,
      message: 'Hire request status updated successfully',
      data: result,
    }
  }

  @Post('reassign/:id')
  @HttpCode(200)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'organization_super_admin')
  @ApiProperty({ description: 'Reassign specific hire request/Panel to another user' })
  @ApiQuery({ name: 'id', required: true, description: 'ID of the hire request' })
  @ApiBody({ type: reassignDTO } )
  @ApiResponse({ status: 200, description: 'Hire request reassigned successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 400, description: 'User ID is required for reassignment' })
  @ApiResponse({ status: 404, description: 'Hire request not found' })
  @ApiResponse({ status: 404, description: 'Panel for this hire request not found' })
  @ApiResponse({ status: 400, description: 'Hire request not reassigned' })
  async reassign(@Param('id') id: string, @CurrentUser() user: USER, @Body() data: reassignDTO) {
    const result = await this.hireRequestService.reassign(id, user, data);
    return {
      status: 200,
      message: 'Hire request reassigned successfully',
      data: result,
    }
  }


}
