import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { USER } from '@prisma/client';

import { HireRequestService } from './hire-request.service';
import { CreateHireRequestDto } from './dto/create-hire-request.dto';
import { UpdateHireRequestDto } from './dto/update-hire-request.dto';

import { AuthGuard } from '../auth/auth.guard';
import { ApiBody, ApiProperty, ApiResponse } from '@nestjs/swagger';
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
    const result = this.hireRequestService.create(createHireRequestDto, user);
    return {
      status: 201,
      message: 'Hire request created successfully',
      data: result,
    }
  }

  @Get()
  findAll() {
    return this.hireRequestService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hireRequestService.findOne(+id);
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
