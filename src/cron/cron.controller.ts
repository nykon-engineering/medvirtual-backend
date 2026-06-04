import { Controller, Get, Query } from '@nestjs/common';
import { CronService } from './cron.service';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { reRunPipelineDto } from './dto/re-run-pipeline.dto';
import { SyncOrganizationsDto } from './dto/sync-organizations.dto';

@ApiTags('cron')
@Controller('cron')
export class CronController {
  constructor(private readonly cron: CronService) {}

  @Get()
  @ApiOperation({
    summary: 'Re-run pipeline for candidates currently in processing status',
  })
  @ApiQuery({
    name: 'status',
    type: reRunPipelineDto,
    description: 'Status to filter candidates for re-running pipeline',
  })
  @ApiResponse({ status: 200, description: 'Pipeline re-run successfully' })
  async reRunPipeline(@Query() status: reRunPipelineDto) {
    const result = await this.cron.reRunPipeline(status);
    return {
      status: 200,
      message: 'Pipeline re-run successfully',
      data: result,
    };
  }

  @Get('get-candidate-id')
  @ApiOperation({
    summary:
      'Sync candidate IDs for staff records missing them by looking up HubSpot',
  })
  @ApiResponse({ status: 200, description: 'Cron working successfully' })
  async getCandidateId() {
    const result = await this.cron.getCandidateId();
    return {
      status: 200,
      message: 'Cron working successfully',
      data: result,
    };
  }

  @Get('system-report')
  @ApiOperation({
    summary: 'Send a system report email with key platform metrics',
  })
  @ApiResponse({ status: 200, description: 'System report sent successfully' })
  async systemReport() {
    const result = await this.cron.systemReport();
    return {
      status: 200,
      message: 'System report sent successfully',
      data: result,
    };
  }

  @Get('sync-clients-with-active-staffs')
  @ApiOperation({
    summary:
      'Sync client organizations that have active staff members in HubSpot',
  })
  @ApiResponse({ status: 200, description: 'Sync completed successfully' })
  async syncClientsWithActiveStaffs() {
    const result = await this.cron.syncClientsWithActiveStaffs();
    return {
      status: 200,
      message: 'the sync was successful',
      data: result,
    };
  }

  @Get('deactivate-client-users-no-staff')
  @ApiOperation({
    summary:
      'Deactivate client users on organizations with no active staff after 60 days of account creation',
  })
  @ApiResponse({
    status: 200,
    description: 'Client users deactivation completed successfully',
  })
  async deactivateClientUsersWithNoStaff() {
    const result = await this.cron.deactivateClientUsersWithNoStaff();
    return {
      status: 200,
      message: 'Client users deactivation completed successfully',
      data: result,
    };
  }

  @Get('update-hubspot-deal-stages')
  @ApiOperation({
    summary: 'Update HubSpot deal stages for all active staff members',
  })
  @ApiResponse({
    status: 200,
    description: 'HubSpot deal stages updated successfully',
  })
  async syncStaffHubspotDealStages() {
    const result = await this.cron.syncStaffHubspotDealStages();
    return {
      status: 200,
      message: 'HubSpot deal stages updated successfully',
      data: result,
    };
  }

  @Get('sync-positions-from-hubspot')
  @ApiOperation({
    summary:
      'Check for new VA positions in HubSpot and create missing entries in PositionRateConfig',
  })
  @ApiResponse({
    status: 200,
    description: 'Position sync completed successfully',
  })
  async syncPositionsFromHubspot() {
    const result = await this.cron.syncPositionsFromHubspot();
    return {
      status: 200,
      message: 'Position sync completed successfully',
      data: result,
    };
  }

  @Get('create-quarterly-payout-requests')
  @ApiOperation({
    summary:
      'Create quarterly payout requests for affiliates with eligible commissions and send a summary report',
  })
  @ApiResponse({
    status: 200,
    description: 'Quarterly payout requests job completed',
  })
  async createQuarterlyPayoutRequests() {
    const result = await this.cron.createQuarterlyPayoutRequests();
    return {
      status: 200,
      message: 'Quarterly payout requests job completed',
      data: result,
    };
  }

  @Get('sync-growth-partners-from-hubspot')
  @ApiOperation({
    summary:
      'Read Growth Partners from HubSpot and create missing ones in the database as affiliate profiles',
  })
  @ApiResponse({ status: 200, description: 'Growth Partners sync completed' })
  async syncGrowthPartnersFromHubspot() {
    const result = await this.cron.syncGrowthPartnersFromHubspot();
    return {
      status: 200,
      message: 'Growth Partners sync completed',
      data: result,
    };
  }

  @Get('sync-invoice-payment-dates')
  @ApiOperation({
    summary:
      'Fetch hs_payment_date from HubSpot for each invoice snapshot missing paid_at and persist it',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice payment dates sync completed',
  })
  async syncInvoicePaymentDates() {
    const result = await this.cron.syncInvoicePaymentDates();
    return {
      status: 200,
      message: 'Invoice payment dates sync completed',
      data: result,
    };
  }

  @Get('sync-invoice-due-dates')
  @ApiOperation({
    summary:
      'Fetch hs_due_date from HubSpot for each invoice snapshot missing due_date and persist it',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice due dates backfill completed',
  })
  async syncInvoiceDueDates() {
    const result = await this.cron.syncInvoiceDueDates();
    return {
      status: 200,
      message: 'Invoice due dates backfill completed',
      data: result,
    };
  }

  @Get('promote-deployed-companies')
  @ApiOperation({
    summary:
      'Promote referred companies deployed 30+ days to eligible status and move their commissions to pending admin confirmation',
  })
  @ApiResponse({
    status: 200,
    description: 'Deployed companies promotion completed',
  })
  async promoteDeployedCompanies() {
    const result = await this.cron.promoteDeployedCompanies();
    return {
      status: 200,
      message: 'Deployed companies promotion completed',
      data: result,
    };
  }

  @Get('daily-commission-summary')
  @ApiOperation({
    summary:
      'Send a daily summary email to admins listing all commissions pending review',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily commission summary sent successfully',
  })
  async dailyCommissionSummary() {
    const result = await this.cron.dailyCommissionSummary();
    return {
      status: 200,
      message: result.sent
        ? `Daily commission summary sent (${result.count} commissions)`
        : 'No pending commissions — email not sent',
      data: result,
    };
  }

  @Get('detect-commissions-by-affiliate')
  @ApiOperation({
    summary:
      'Detect and create missing commissions for all organizations referred by a specific affiliate. Uses existing eligibility rules — safe to re-run (idempotent).',
  })
  @ApiQuery({
    name: 'affiliate_profile_id',
    required: true,
    type: String,
    description: 'UUID of the affiliate profile to process.',
  })
  @ApiResponse({
    status: 200,
    description: 'Commission detection completed',
  })
  async detectCommissionsByAffiliate(
    @Query('affiliate_profile_id') affiliateProfileId: string,
  ) {
    const result =
      await this.cron.detectCommissionsByAffiliate(affiliateProfileId);
    return {
      status: 200,
      message: 'Commission detection completed',
      data: result,
    };
  }

  @Get('sync-hire-request-titles')
  @ApiOperation({
    summary:
      'One-time sync: rebuild HireRequest titles that are missing hubspot_role_type, updating both DB and HubSpot',
  })
  @ApiResponse({
    status: 200,
    description: 'Hire request title sync completed',
  })
  async syncHireRequestTitles() {
    const result = await this.cron.syncHireRequestTitles();
    return {
      status: 200,
      message: 'Hire request title sync completed',
      data: result,
    };
  }

  @Get('sync-organizations-with-hubspot')
  @ApiOperation({
    summary:
      'Full Med Alliance sync for referred organizations: resolves HubSpot company ID, ingests invoices, detects commissions, and promotes eligible companies. Pass organization_id to target a single org; omit to process all referred organizations.',
  })
  @ApiQuery({
    name: 'organization_id',
    required: false,
    type: String,
    description:
      'UUID of a single organization to sync. If omitted, all referred organizations are processed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization sync completed',
  })
  async syncOrganizationsWithHubspot(@Query() query: SyncOrganizationsDto) {
    const result = await this.cron.syncOrganizationsWithHubspot(
      query.organization_id,
    );
    return {
      status: 200,
      message: 'Organization sync completed',
      data: result,
    };
  }
}
