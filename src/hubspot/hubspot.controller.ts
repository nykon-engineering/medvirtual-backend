import { Controller, Post, UseGuards, HttpCode, Body, Get, Query, Param } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiProperty, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { HubspotService } from './hubspot.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GetCandidatesDto } from './dto/get-candidates.dto';

@Controller('hubspot')
export class HubspotController {

    constructor(private readonly hubspotService: HubspotService){}

    @Post('candidates')
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('user', 'admin', 'system_super_admin')
    @HttpCode(200)
    @ApiOperation({ summary: 'Get candidates from HubSpot with dynamic filters' })
    @ApiBody({type: GetCandidatesDto, description: 'Data to get candidates from HubSpot', required: true})
    @ApiResponse({ status: 200, description: 'Returns candidates below dynamic filters' })
    @ApiResponse({ status: 400, description: 'Data is required' })
    @ApiResponse({ status: 400, description: 'Virtual Assistant identifier is required' })
    @ApiResponse({ status: 400, description: 'Error fetching candidates' })
    async getCandidates(@Body() data: GetCandidatesDto) {
        return this.hubspotService.getCandidates(data);
    }

    @Post('webhook')
    async webhook(@Body() data: any) {
        //console.log('Webhook received:', data);
        return this.hubspotService.changeDataFromHubspot(data);
    }

    @Post('create-candidates')
    @ApiProperty({ description: 'Create candidates with data from HubSpot by specific pipeline stage' })
    @ApiQuery({ name: 'pipeline_stage', required: true, description: 'Pipeline stage to filter candidates' })
    @UseGuards(AuthGuard)
    async createCandidates(@Query('pipeline_stage') pipeline_stage: string){
        return this.hubspotService.createCandidates(pipeline_stage);
    }

    @Post('update-candidates')
    @ApiProperty({ description: 'Update candidates with data from HubSpot by specific pipeline stage' })
    @ApiQuery({ name: 'pipeline_stage', required: true, description: 'Pipeline stage to filter candidates' })
    @UseGuards(AuthGuard)
    async updateCandidates(@Query('pipeline_stage') pipeline_stage: string){
        return this.hubspotService.updateCandidates(pipeline_stage);
    }

    @Get('country')
    @ApiProperty({ description: 'Get all countries from HubSpot' })
    @UseGuards(AuthGuard)
    @HttpCode(200)
    @ApiOperation({ summary: 'Get all countries from HubSpot' })
    @ApiResponse({ status: 200, description: 'Returns all countries from HubSpot' })
    async getCountries() {
        console.log('Fetching countries from HubSpot');
        const result = await this.hubspotService.getCountries();
        return result;
    }


    //=> this route is just a example to read candidates and download resume
    @Post('candidates-download')
    //@UseGuards(AuthGuard, RolesGuard)
    //@Roles('user', 'admin', 'system_super_admin')
    @HttpCode(200)
    @ApiOperation({ summary: 'Get candidates from HubSpot with dynamic filters' })
    @ApiBody({type: GetCandidatesDto, description: 'Data to get candidates from HubSpot', required: true})
    @ApiResponse({ status: 200, description: 'Returns candidates below dynamic filters' })
    @ApiResponse({ status: 400, description: 'Data is required' })
    @ApiResponse({ status: 400, description: 'Virtual Assistant identifier is required' })
    @ApiResponse({ status: 400, description: 'Error fetching candidates' })
    async getCandidates2(@Body() data: GetCandidatesDto) {
        return this.hubspotService.getCandidatesAndDownload(data);
    }
}


