import { Controller, Get, Query } from '@nestjs/common';
import { CronService } from './cron.service';
import { ApiProperty, ApiQuery } from '@nestjs/swagger';
import { reRunPipelineDto } from './dto/re-run-pipeline.dto';

@Controller('cron')
export class CronController {

    constructor(
        private readonly cron: CronService
    ) {}

    @Get()
    @ApiProperty({ description: 'Trigger the cron job to re-run pipeline of the candidates on processing' })
    @ApiQuery({ name: 'status', type: reRunPipelineDto, description: 'Status to filter candidates for re-running pipeline' })
    async reRunPipeline(@Query() status: reRunPipelineDto) {
        const result = await this.cron.reRunPipeline(status);
        return {
            status: 200,
            message: 'Pipeline re-run successfully',
            data: result
        }
    }


    @Get('get-candidate-id')
    @ApiProperty({ description: 'Trigger the cron job to get current staffs without candidate_id and check it on hubspot' })
    async getCandidateId() {
        const result = await this.cron.getCandidateId();
        return {
            status: 200,
            message: 'Cron working successfully',
            data: result
        }
    }

    @Get('system-report')
    @ApiProperty({ description: 'Send email with important datas' })
    async systemReport() {
        const result = await this.cron.systemReport();
        return {
            status: 200,
            message: 'System report sent successfully',
            data: result
        }
    }

    @Get('sync-clients-with-active-staffs')
    @ApiProperty({ description: 'Send email with important datas' })
    async syncClientsWithActiveStaffs() {
        const result = await this.cron.syncClientsWithActiveStaffs();
        return {
            status: 200,
            message: 'the sync was successful',
            data: result
        }
    }

    @Get('deactivate-client-users-no-staff')
    @ApiProperty({ description: 'Deactivate active client users and remove invited ones on clients with no active staff after 60 days of user creation' })
    async deactivateClientUsersWithNoStaff() {
        const result = await this.cron.deactivateClientUsersWithNoStaff();
        return {
            status: 200,
            message: 'Client users deactivation completed successfully',
            data: result
        }
    }

    @Get('update-hubspot-deal-stages')
    @ApiProperty({ description: 'Update HubSpot deal stages for staffs' })
    async syncStaffHubspotDealStages() {
        const result = await this.cron.syncStaffHubspotDealStages();
        return {
            status: 200,
            message: 'HubSpot deal stages updated successfully',
            data: result
        }
    }

    @Get('sync-positions-from-hubspot')
    @ApiProperty({ description: 'Check for new VA positions in HubSpot and create them in PositionRateConfig if missing' })
    async syncPositionsFromHubspot() {
        const result = await this.cron.syncPositionsFromHubspot();
        return {
            status: 200,
            message: 'Position sync completed successfully',
            data: result,
        };
    }

    @Get('create-quarterly-payout-requests')
    @ApiProperty({ description: 'Create payout requests for all affiliates with at least one eligible commission and send a summary report email' })
    async createQuarterlyPayoutRequests() {
        const result = await this.cron.createQuarterlyPayoutRequests();
        return {
            status: 200,
            message: 'Quarterly payout requests job completed',
            data: result,
        };
    }

}