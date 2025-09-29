import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query, HttpCode } from '@nestjs/common';
import { USER } from '@prisma/client';
import { ApiBody, ApiParam, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { CandidatesService } from './candidates.service';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { updateStatusHubspotDTO } from './dto/updateStatus-candidate.dto';
import { EndorseCandidateDto } from './dto/endorse-candidate.dto';



@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all candidates for the current user\'s organization filtered by status' })
  @ApiQuery({ name: 'country', required: false, type: String, description: 'Filter candidates by conuntry of residence', example: "USA, France, Brazil" })
  @ApiQuery({ name: 'availiability', required: false, type: String, description: 'Filter candidates by avaliability', example: "Full-time, Part-time" })
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
    @Query('availiability') avaliability: string, 
    @Query('monthly_compensation_from') monthly_compensation_from: string, 
    @Query('monthly_compensation_to') monthly_compensation_to: string, 
    @Query('years_of_experience') years_of_experience: string,
    @Query('specializations') specializations: string,
    @Query('skills') skills: string,
    @Query('languages') languages: string,
    @Query('page') page,
    @Query('perPage') perPage,
    @Query('search') search: string,
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
      perPage,
      search,
    );
    return result
  }


  @Get('candidate/:id')
  @ApiOperation({ summary: 'Get a specific candidate by ID' })
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
  @ApiOperation({ summary: 'Update a specific candidate by ID' })
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
  @ApiOperation({ summary: 'Process data for a specific candidate by ID' })
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
  @ApiOperation({ summary: 'Get all pipelines' })
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
  @ApiOperation({ summary: 'Get all countries from HubSpot' })
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
  @ApiOperation({ summary: 'Update status of candidates and reflect it on Hubspot' })
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

  @Get('/show-match-hirerequests/:idCandidate')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ description: 'Show possible hire requests for a specific candidate' })
  @ApiParam({ name: 'candidateId', required: true, type: String, description: 'Candidate ID' })
  @ApiResponse({ status: 200, description: 'Data retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found or not part of an organization' })
  @ApiResponse({ status: 404, description: 'User role not found' })
  async matchHireRequest(
    @CurrentUser() user: USER, 
    @Param('idCandidate') candidateId: string,
  ) {
    const result = await this.candidatesService.showMatchHireRequests(user, candidateId);
    return {
      status: 200,
      message: 'Data retrieved successfully',
      data: result,
    }
  }

  @Post('endorse-candidate')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('system_super_admin', 'system_admin')
  @ApiOperation({ summary: 'Endorse a candidate' })
  @ApiBody({ type: EndorseCandidateDto })
  @ApiResponse({ status: 200, description: 'Candidate endorsed successfully' })
  @ApiResponse({ status: 400, description: 'Candidate ID is required' })
  @ApiResponse({ status: 400, description: 'Hire Request ID is required' })
  @ApiResponse({ status: 404, description: 'Hire Request not found in candidate panel' })
  @ApiResponse({ status: 400, description: 'Failed to endorse candidate' })

  async endorseCandidate(@Body() data: EndorseCandidateDto){
    console.log('Endorsing candidate - controller:', data);
    const result = await this.candidatesService.endorseCandidate(data);
    return {
      status: 200,
      message: 'Candidate endorsed successfully',
      data: result
    }
  } 
}
