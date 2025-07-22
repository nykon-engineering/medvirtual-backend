import { Controller, Post, UseGuards, HttpCode, Body, Get, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { HubspotService } from './hubspot.service';

import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GetCandidatesDto } from './dto/get-candidates.dto';

@Controller('hubspot')
export class HubspotController {

    constructor(private readonly hubspotService: HubspotService){}

    @Post('candidates')
    //@UseGuards(AuthGuard, RolesGuard)
    //@Roles('user', 'admin', 'SuperAdmin')
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
    async webhook(@Body() body: any) {
        console.log('Received webhook:', body);
        return body;
    }

   
    @Post('candidates-download')
    //@UseGuards(AuthGuard, RolesGuard)
    //@Roles('user', 'admin', 'SuperAdmin')
    @HttpCode(200)
    @ApiOperation({ summary: 'Get candidates from HubSpot with dynamic filters' })
    @ApiBody({type: GetCandidatesDto, description: 'Data to get candidates from HubSpot', required: true})
    @ApiResponse({ status: 200, description: 'Returns candidates below dynamic filters' })
    @ApiResponse({ status: 400, description: 'Data is required' })
    @ApiResponse({ status: 400, description: 'Virtual Assistant identifier is required' })
    @ApiResponse({ status: 400, description: 'Error fetching candidates' })
    async getCandidates2(@Body() data: GetCandidatesDto) {
        return this.hubspotService.getCandidates2(data);
    }
}


