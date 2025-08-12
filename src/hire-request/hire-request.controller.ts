import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { USER } from '@prisma/client';

import { HireRequestService } from './hire-request.service';
import { CreateHireRequestDto } from './dto/create-hire-request.dto';
import { UpdateHireRequestDto } from './dto/update-hire-request.dto';

import { AuthGuard } from '../auth/auth.guard';
import { ApiBody, ApiProperty, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';


@Controller('hire-request')
export class HireRequestController {
  constructor(private readonly hireRequestService: HireRequestService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiProperty({ description: 'Create new hire request' })
  @ApiBody({ type: CreateHireRequestDto })
  @ApiResponse({ status: 200, description: 'Hire request created successfully' })
  async create(@Body() createHireRequestDto: CreateHireRequestDto, @CurrentUser() user: USER): Promise<object> {
    console.log('Creating hire request:', createHireRequestDto);
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
  update(@Param('id') id: string, @Body() updateHireRequestDto: UpdateHireRequestDto) {
    return this.hireRequestService.update(+id, updateHireRequestDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.hireRequestService.remove(+id);
  }
}
