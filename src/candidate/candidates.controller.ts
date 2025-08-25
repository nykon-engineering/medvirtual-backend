import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, HttpCode } from '@nestjs/common';
import { CandidatesService } from './candidates.service';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { USER } from '@prisma/client';
import { ApiBody, ApiParam, ApiProperty, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { updateStatusHubspotDTO } from './dto/updateStatus-candidate.dto';
import { identity } from 'rxjs';

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
  @ApiQuery({ name: 'specializations', required: false, type: Number, description: 'Filter candidates by specializations', example: "pediatric" })
  @ApiQuery({ name: 'skills', required: false, type: Number, description: 'Filter candidates by skills', example: "office, communication" })
  @ApiQuery({ name: 'languages', required: false, type: Number, description: 'Filter candidates by languages spoken', example: "English, Spanish" })
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
    @Query('specializations') specializations: string,
    @Query('skills') skills: string,
    @Query('languages') languages: string,
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
      specializations,
      skills,
      languages,
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
    console.log('Processing data for candidate ID -  controller:', id);
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

  @Get('properties/all')
  @ApiProperty({ description: 'Get all countries from HubSpot' })
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @ApiQuery({ name: 'fields', required: false, type: String, description: 'fields properties ', example: "country,specialization, languages, skills, salary_range", })
  @ApiResponse({ status: 200, description: 'Returns properties from Candidates' })
  async getCountries(@Query() fields: string) {
      const result = await this.candidatesService.getProperties(fields);
      return result;
  }

  @Post('update-status/:id')
  @HttpCode(200)
  @ApiProperty({ description: 'Update status of candidates and reflect it on Hubspot' })
  @ApiParam({ name: 'id', required: true, type: String, description: 'Candidate ID' })
  @ApiBody({ type: updateStatusHubspotDTO})
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Candidate ID is required' })
  @ApiResponse({ status: 400, description: 'Status data is required' })
  @ApiResponse({ status: 400, description: 'Invalid status provided' })
  @ApiResponse({ status: 404, description: 'Candidate not found' })
  @ApiResponse({ status: 400, description: 'Failed to update candidate status in HubSpot' })
  @ApiResponse({ status: 400, description: 'Failed to update candidate status' })
  @UseGuards(AuthGuard)
  async updateStatus(@Param('id') id: string, @Body() data: updateStatusHubspotDTO) {
    const result = await this.candidatesService.updateStatusHubspot(id,data);
    return {
      status: 200,
      message: 'Status updated successfully',
      data: result
    }
  }

}
