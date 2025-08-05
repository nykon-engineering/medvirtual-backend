import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CandidatesService } from './candidates.service';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { ApiParam, ApiProperty, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { UpdateCandidateDto } from './dto/update-candidate.dto';

@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  @ApiProperty({ description: 'Get all candidates for the current user\'s organization filtered by status' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter candidates by status', example: "New Candidates, Available, Hired" })
  @ApiResponse({ status: 200, description: 'Candidates retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Failed to fetch candidates' })
  @UseGuards(AuthGuard)
  async findAll(@CurrentUser() user: USER, @Query('status') status: string) {
    const result = await this.candidatesService.findAll(user, status);
    return {
      status: 200,
      message: 'Candidates retrieved successfully',
      data: result
    }
  }


  @Get(':id')
  @ApiProperty({ description: 'Get a specific candidate by ID' })
  @ApiParam({ name: 'id', required: true, type: String, description: 'Candidate ID' })
  @ApiResponse({ status: 200, description: 'Candidate retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Candidate ID is required' })
  @ApiResponse({ status: 401, description: 'Candidate not found' })
  @UseGuards(AuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: USER) {
    const result = await this.candidatesService.findOne(id, user);
    return {
      status: 200,
      message: 'Candidate retrieved successfully',
      data: result
    }
  }

  @Patch(':id')
  @ApiProperty({ description: 'Update a specific candidate by ID' })
  @ApiParam({ name: 'id', required: true, type: String, description: 'Candidate ID' })
  @ApiResponse({ status: 200, description: 'Candidate updated successfully' })
  @ApiResponse({ status: 400, description: 'Candidate ID is required' })
  @UseGuards(AuthGuard)
  async update(@Param('id') id: string, @Body() data: UpdateCandidateDto) {
    const result = await this.candidatesService.update(id, data);
    return {
      status: 200,
      message: 'Candidate updated successfully',
      data: result
    }
  }

  @Get('/process-data/:id')
  @ApiProperty({ description: 'Process data for a specific candidate by ID' })
  @ApiParam({ name: 'id', required: true, type: String, description: 'Candidate ID' })
  @ApiResponse({ status: 200, description: 'Candidate data processed successfully' })
  @ApiResponse({ status: 400, description: 'Candidate ID is required' })
  @UseGuards(AuthGuard)
  async processData(@Param('id') id: string) {
    const result = await this.candidatesService.processData(id);
    return {
      status: 200,
      message: 'Candidate data processed successfully',
    }
  }

  @Get('/pipelines/all')
  @ApiProperty({ description: 'Get all pipelines' })
  @ApiResponse({ status: 200, description: 'Pipelines retrieved successfully' })
  @UseGuards(AuthGuard)
  async getPipelines() {
    const result = await this.candidatesService.getPipelines();
    return {
      status: 200,
      message: 'Pipelines retrieved successfully',
      data: result
    }
  }

}
