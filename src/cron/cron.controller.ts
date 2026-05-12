import { Controller, Get, Query } from '@nestjs/common';
import { CronService } from './cron.service';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { reRunPipelineDto } from './dto/re-run-pipeline.dto';

@ApiTags('cron')
@Controller('cron')
export class CronController {

    constructor(
        private readonly cron: CronService
    ) {}

    @Get()
    @ApiOperation({ summary: 'Re-run pipeline for candidates currently in processing status' })
    @ApiQuery({ name: 'status', type: reRunPipelineDto, description: 'Status to filter candidates for re-running pipeline' })
    @ApiResponse({ status: 200, description: 'Pipeline re-run successfully' })
    async reRunPipeline(@Query() status: reRunPipelineDto) {
        const result = await this.cron.reRunPipeline(status);
        return {
            status: 200,
            message: 'Pipeline re-run successfully',
            data: result
        }
    }


    @Get('get-candidate-id')
    @ApiOperation({ summary: 'Sync candidate IDs for staff records missing them by looking up HubSpot' })
    @ApiResponse({ status: 200, description: 'Cron working successfully' })
    async getCandidateId() {
        const result = await this.cron.getCandidateId();
        return {
            status: 200,
            message: 'Cron working successfully',
            data: result
        }
    }

    @Get('system-report')
    @ApiOperation({ summary: 'Send a system report email with key platform metrics' })
    @ApiResponse({ status: 200, description: 'System report sent successfully' })
    async systemReport() {
        const result = await this.cron.systemReport();
        return {
            status: 200,
            message: 'System report sent successfully',
            data: result
        }
    }

    @Get('sync-clients-with-active-staffs')
    @ApiOperation({ summary: 'Sync client organizations that have active staff members in HubSpot' })
    @ApiResponse({ status: 200, description: 'Sync completed successfully' })
    async syncClientsWithActiveStaffs() {
        const result = await this.cron.syncClientsWithActiveStaffs();
        return {
            status: 200,
            message: 'the sync was successful',
            data: result
        }
    }

    @Get('deactivate-client-users-no-staff')
    @ApiOperation({ summary: 'Deactivate client users on organizations with no active staff after 60 days of account creation' })
    @ApiResponse({ status: 200, description: 'Client users deactivation completed successfully' })
    async deactivateClientUsersWithNoStaff() {
        const result = await this.cron.deactivateClientUsersWithNoStaff();
        return {
            status: 200,
            message: 'Client users deactivation completed successfully',
            data: result
        }
    }

    @Get('update-hubspot-deal-stages')
    @ApiOperation({ summary: 'Update HubSpot deal stages for all active staff members' })
    @ApiResponse({ status: 200, description: 'HubSpot deal stages updated successfully' })
    async syncStaffHubspotDealStages() {
        const result = await this.cron.syncStaffHubspotDealStages();
        return {
            status: 200,
            message: 'HubSpot deal stages updated successfully',
            data: result
        }
    }

    @Get('sync-positions-from-hubspot')
    @ApiOperation({ summary: 'Check for new VA positions in HubSpot and create missing entries in PositionRateConfig' })
    @ApiResponse({ status: 200, description: 'Position sync completed successfully' })
    async syncPositionsFromHubspot() {
        const result = await this.cron.syncPositionsFromHubspot();
        return {
            status: 200,
            message: 'Position sync completed successfully',
            data: result,
        };
    }

    @Get('create-quarterly-payout-requests')
    @ApiOperation({ summary: 'Create quarterly payout requests for affiliates with eligible commissions and send a summary report' })
    @ApiResponse({ status: 200, description: 'Quarterly payout requests job completed' })
    async createQuarterlyPayoutRequests() {
        const result = await this.cron.createQuarterlyPayoutRequests();
        return {
            status: 200,
            message: 'Quarterly payout requests job completed',
            data: result,
        };
    }

    @Get('promote-deployed-companies')
    @ApiOperation({ summary: 'Promote referred companies deployed 30+ days to eligible status and move their commissions to pending admin confirmation' })
    @ApiResponse({ status: 200, description: 'Deployed companies promotion completed' })
    async promoteDeployedCompanies() {
        const result = await this.cron.promoteDeployedCompanies();
        return {
            status: 200,
            message: 'Deployed companies promotion completed',
            data: result,
        };
    }

}