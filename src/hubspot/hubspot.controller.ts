import { Controller, Inject, Get } from '@nestjs/common';
import { HubspotService } from './hubspot.service';
import { ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';

@Controller('hubspot')
export class HubspotController {

    @Inject()
    private readonly hubspotService: HubspotService;

    //public route for while
    @ApiOperation({ summary: 'Get candidates from HubSpot on the FOR STAFFING stage' })
    @Get('candidates')
    async getCandidates() {
        return this.hubspotService.getCandidates();
    }
}


