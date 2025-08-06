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
  @ApiQuery({ name: 'country', required: false, type: String, description: 'Filter candidates by conuntry of residence', example: "USA, France, Brazil" })
  @ApiQuery({ name: 'avaliability', required: false, type: String, description: 'Filter candidates by avaliability', example: "Full-time, Part-time" })
  @ApiQuery({ name: 'monthly_compensation_from', required: false, type: String, description: 'Filter candidates by monthly compensations start', example: "1000" })
  @ApiQuery({ name: 'monthly_compensation_to', required: false, type: String, description: 'Filter candidates by monthly compensations end', example: "5000" })
  @ApiQuery({ name: 'years_of_experience', required: false, type: Number, description: 'Filter candidates by years of experience', example: "5" })
  @ApiResponse({ status: 200, description: 'Candidates retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Failed to fetch candidates' })
  @UseGuards(AuthGuard)
  async findAll(
    @CurrentUser() user: USER, 
    @Query('country') country: string, 
    @Query('avaliability') avaliability: string, 
    @Query('monthly_compensation_from') monthly_compensation_from: string, 
    @Query('monthly_compensation_to') monthly_compensation_to: string, 
    @Query('years_of_experience') years_of_experience: string,
    @Query('page') page,
    @Query('perPage') perPage
  ) {
    const result = await this.candidatesService.findAll(
      user, 
      country, 
      avaliability, 
      monthly_compensation_from, 
      monthly_compensation_to, 
      years_of_experience,
      page,
      perPage
    );
    return result
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
