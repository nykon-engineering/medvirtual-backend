import { Controller, Post, UseGuards, HttpCode, Body } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { HubspotService } from './hubspot.service';

import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('hubspot')
export class HubspotController {

    constructor(private readonly hubspotService: HubspotService){}

    
    //public route for while
    @Post('candidates')
    //@UseGuards(AuthGuard, RolesGuard)
    //@Roles('user', 'admin', 'SuperAdmin')

    @HttpCode(200)
    @ApiOperation({ summary: 'Get candidates from HubSpot with dynamic filters' })
    @ApiResponse({ status: 200, description: 'Returns candidates below dynamic filters' })
    @ApiResponse({ status: 400, description: 'Data is required' })
    @ApiResponse({ status: 400, description: 'Virtual Assistant identifier is required' })
    @ApiResponse({ status: 400, description: 'Error fetching candidates' })
    async getCandidates(@Body() data: any) {
        return this.hubspotService.getCandidates(data);
    }
}


