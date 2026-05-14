import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { reRunPipelineDto } from './dto/re-run-pipeline.dto';
import { CandidatesService } from '../candidate/candidates.service';
import axios from 'axios';
import { HandlerObjectCreation } from '../hubspot/handlers/objectCreation';
import systemReport from '../common/utils/email-templates/system-report';
import clientUsersDeactivationReport from '../common/utils/email-templates/client-users-deactivation-report';
import cronJobErrorReport from '../common/utils/email-templates/cron-job-error-report';
import newPositionsAlert from '../common/utils/email-templates/new-positions-alert';
import quarterlyPayoutReport, {
  PayoutReportEntry,
  PayoutReportFailure,
} from '../common/utils/email-templates/quarterly-payout-report';
import medAllianceDeployedCompaniesReport, {
  PromotedCompanyEntry,
} from '../common/utils/email-templates/med-alliance-deployed-companies-report';
import { MailService } from '../mail/mail.service';
import { activePipelines } from '../common/constant/activeDealPipelines';
import { HireRequestService } from '../hire-request/hire-request.service';
import { PositionRateConfigService } from '../position-rate-config/position-rate-config.service';
import { PayoutRequestsService } from '../med-alliance/payout-requests/payout-requests.service';
import { AffiliateStatus } from '@prisma/client';

type Event = {
  objectId?: string;
};

@Injectable()
export class CronService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidate: CandidatesService,
    private readonly objectCreation: HandlerObjectCreation,
    private readonly mailService: MailService,
    private readonly hireRequestService: HireRequestService,
    private readonly positionRateConfigService: PositionRateConfigService,
    private readonly payoutRequestsService: PayoutRequestsService,
  ) {}

  async reRunPipeline(statusDto: reRunPipelineDto): Promise<boolean> {
    //return false;
    const { status } = statusDto;
    const candidates = await this.prisma.candidate.findMany({
      where: {
        processing_status: status === 'failed' ? { not: 'completed' } : status,
        AND: [
          { resume_url: { not: null } },
          { resume_url: { not: 'To Follow' } },
          { resume_url: { not: 'To follow' } },
          { resume_url: { not: 'N/A' } },
        ],
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
      },
      orderBy: {
        processed_at: 'desc',
      },
    });

    if (process.env.ENVIRONMENT === 'PROD') {
      for (const candidate of candidates) {
        console.log(
          `Re-running pipeline for candidate ID: ${candidate.id}, Name: ${candidate.first_name} ${candidate.last_name}`,
        );
        try {
          await this.candidate.processData(candidate.id);
          console.log(
            `===>Finished Pipeline for the candidate ID: ${candidate.id}`,
          );
        } catch {
          await this.prisma.candidate.update({
            where: { id: candidate.id },
            data: {
              processing_status: 'failed',
            },
          });
          console.log(
            `===>Error in Pipeline for the candidate ID: ${candidate.id}`,
          );
        }
      }
    } else {
      console.log('Environment is not PROD. Skipping re-run of pipelines.');
    }
    return true;
  }

  async getCandidateId(): Promise<boolean> {
    console.log('Starting getCandidateId cron job...');
    const staffs = await this.prisma.staff.findMany({
      where: {
        candidate_id: null,
        hubspot_id: { not: null },
      },
      select: {
        id: true,
        hubspot_id: true,
      },
    });

    for (const staff of staffs) {
      const event: Event = {};
      const getObjectVA = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/deals/${staff.hubspot_id}/associations/${process.env.HUBSPOT_CUSTOM_OBJECT}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      //console.log('getObjectVA: ', getObjectVA.data);

      if (getObjectVA?.data?.results?.length > 0) {
        let candidateExists = await this.prisma.candidate.findUnique({
          where: {
            hubspot_id: String(getObjectVA.data.results[0].id),
          },
          select: {
            id: true,
          },
        });

        if (!candidateExists) {
          event.objectId = getObjectVA.data.results[0].id;
          //=> call the candidate creation service
          await this.objectCreation.execute(event);

          candidateExists = await this.prisma.candidate.findUnique({
            where: {
              hubspot_id: String(getObjectVA.data.results[0].id),
            },
            select: {
              id: true,
            },
          });
        }

        await this.prisma.staff.update({
          where: { id: staff.id },
          data: {
            hubspot_candidate_id: String(getObjectVA.data.results[0].id),
            candidate_id: candidateExists ? candidateExists.id : null,
          },
        });
      }
    }
    await this.prisma.sync.create({
      data: {
        role: 'get-candidate-id',
        last_synced_at: new Date(),
      },
    });
    return true;
  }

  async systemReport(): Promise<boolean> {
    try {
      const availableCandidates = await this.prisma.candidate.count({
        where: {
          OR: [
            { pipeline_status: '261075105' },
            { pipeline_status: '1087596819' },
          ],
        },
      });

      const endorsedCandidates = await this.prisma.candidate.count({
        where: {
          pipeline_status: '1172847191',
        },
      });

      const withoutResume = await this.prisma.candidate.count({
        where: {
          pipeline_status: {
            in: ['261075105', '1087596819'],
          },
          OR: [
            { resume_url: null },
            { resume_url: 'To Follow' },
            { resume_url: 'To follow' },
            { resume_url: 'N/A' },
            { resume_url: 'n/a' },
          ],
        },
      });

      const failedResumeParsing = await this.prisma.candidate.findMany({
        where: {
          pipeline_status: {
            in: ['261075105', '1087596819'],
          },
          processing_status: 'failed',
          resume_url: { not: null },
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          name: true,
          hubspot_id: true,
          processing_error: true,
        },
      });

      const withoutHeadshot = await this.prisma.candidate.findMany({
        where: {
          pipeline_status: {
            in: ['261075105', '1087596819'],
          },
          OR: [
            { headshot_url: null },
            { headshot_url: 'n/a' },
            { headshot_url: 'N/A' },
          ],
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          name: true,
          hubspot_id: true,
        },
      });

      const emailBody = systemReport(
        availableCandidates,
        endorsedCandidates,
        withoutResume,
        failedResumeParsing,
        withoutHeadshot,
      );
      const mailSent = await this.mailService.sendMail({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: 'shayan@regenta.ai',
        cc: ['paulo@regenta.ai', 'hanieh@medvirtual.ai'],
        subject: 'System Report',
        html: emailBody,
      });
      if (!mailSent) {
        console.log('Failed to send system report email notification.');
      }

      return true;
    } catch (error) {
      console.error('Error generating system report:', error);
      return false;
    }
  }

  async syncClientsWithActiveStaffs(): Promise<boolean> {
    try {
      //Get just active pipelines from hubspot

      const inactiveClients = await this.prisma.organization.findMany({
        where: {
          status: 'inactive',
          staff: {
            some: {
              hubspot_dealstage: { in: activePipelines.map(([key]) => key) },
            },
          },
        },
        select: {
          id: true,
          name: true,
          staff: {
            select: {
              id: true,
              hubspot_id: true,
              hubspot_deal_name: true,
              hubspot_dealstage: true,
            },
          },
        },
      });

      console.log(`Inactive clients Found:`, inactiveClients);

      //update them for active
      await Promise.all(
        inactiveClients.map(async (client) => {
          console.log(
            `Updating client ${client.name} (ID: ${client.id}) to active status.`,
          );
          await this.prisma.organization.update({
            where: { id: client.id },
            data: {
              status: 'active',
            },
          });
        }),
      );

      return true;
    } catch (error) {
      console.error('Error syncing clients with active staffs:', error);
      return false;
    }
  }

  async deactivateClientUsersWithNoStaff(): Promise<boolean> {
    console.log('Starting deactivateClientUsersWithNoStaff cron job...');

    try {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Find organizations that have NO staff at all (regardless of status)
      const clientsWithNoActiveStaff = await this.prisma.organization.findMany({
        where: {
          staff: {
            none: {},
          },
        },
        select: { id: true, name: true },
      });

      if (clientsWithNoActiveStaff.length === 0) {
        console.log('No clients found with no active staff.');
        return true;
      }

      const organizationIds = clientsWithNoActiveStaff.map((org) => org.id);
      const orgNameById = Object.fromEntries(
        clientsWithNoActiveStaff.map((org) => [org.id, org.name]),
      );
      console.log(`Found ${organizationIds.length} clients with no staff.`);

      const userSelect = {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        organization_id: true,
      };

      // Collect active users for the report before updating
      const usersToDeactivate = await this.prisma.uSER.findMany({
        where: {
          organization_id: { in: organizationIds },
          status: 'active',
          createdAt: { lte: sixtyDaysAgo },
        },
        select: userSelect,
      });

      await this.prisma.uSER.updateMany({
        where: { id: { in: usersToDeactivate.map((u) => u.id) } },
        data: { status: 'inactive', status_before_deactivation: 'active' },
      });

      console.log(`Deactivated ${usersToDeactivate.length} active users.`);

      // Find invited users created more than 60 days ago to delete
      const invitedUsersToDelete = await this.prisma.uSER.findMany({
        where: {
          organization_id: { in: organizationIds },
          status: 'invited',
          createdAt: { lte: sixtyDaysAgo },
        },
        select: userSelect,
      });

      console.log(
        `Found ${invitedUsersToDelete.length} invited users to delete.`,
      );

      for (const user of invitedUsersToDelete) {
        await this.prisma.$transaction(async (tx) => {
          await tx.emailVerification.deleteMany({ where: { userId: user.id } });
          await tx.emailInvitation.deleteMany({ where: { userId: user.id } });
          await tx.uSER.delete({ where: { id: user.id } });
        });
        console.log(`Deleted invited user: ${user.email}`);
      }

      // Send report email
      const toReportUser = (u: (typeof usersToDeactivate)[number]) => ({
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        organization_name: u.organization_id
          ? (orgNameById[u.organization_id] ?? 'N/A')
          : 'N/A',
      });

      const emailBody = clientUsersDeactivationReport(
        usersToDeactivate.map(toReportUser),
        invitedUsersToDelete.map(toReportUser),
        new Date(),
      );

      await this.mailService.sendMail({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: 'paulo@regenta.ai',
        cc: ['paulo@regenta.ai'],
        subject: 'Client Users Deactivation Report',
        html: emailBody,
      });

      console.log('deactivateClientUsersWithNoStaff cron job completed.');
      return true;
    } catch (error) {
      console.error('Error in deactivateClientUsersWithNoStaff:', error);
      try {
        const emailBody = cronJobErrorReport(
          'deactivate-client-users-no-staff',
          error,
          new Date(),
        );
        await this.mailService.sendMail({
          from: 'MedVirtual <noreply@medvirtual.ai>',
          to: 'paulo@regenta.ai',
          cc: ['paulo@regenta.ai'],
          subject: '[ERROR] Client Users Deactivation Cron Job Failed',
          html: emailBody,
        });
      } catch (mailError) {
        console.error('Failed to send error report email:', mailError);
      }
      return false;
    }
  }

  async syncStaffHubspotDealStages(): Promise<boolean> {
    try {
      const staffs = await this.prisma.staff.findMany({
        where: {
          hubspot_id: { not: null },
          hubspot_pipeline: '5155250', //5155250 => BV OPERATIONS | 85165570 => MV OPERATIONS
          status: 'active',
        },
        select: {
          id: true,
          hubspot_id: true,
        },
        orderBy: {
          updated_at: 'asc',
        },
      });

      for (const staff of staffs) {
        try {
          const response = await axios.get(
            `https://api.hubapi.com/crm/v3/objects/deals/${staff.hubspot_id}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
            },
          );

          const dealstage = response.data.properties.dealstage;

          await this.prisma.staff.update({
            where: { id: staff.id },
            data: {
              hubspot_dealstage: dealstage,
              status: activePipelines.some(([key]) => key === dealstage)
                ? 'active'
                : 'inactive',
            },
          });
        } catch (error) {
          console.error(`Error updating staff ID ${staff.id}:`, error);
        }
      }

      return true;
    } catch (error) {
      console.error('Error syncing staff HubSpot deal stages:', error);
      return false;
    }
  }

  async syncPositionsFromHubspot(): Promise<boolean> {
    try {
      console.log('Starting syncPositionsFromHubspot cron job...');

      const hubspotOptions = await this.hireRequestService.getVATypes();
      const hubspotPositions: string[] = hubspotOptions.map(
        (opt: { label: string }) => opt.label,
      );

      const existingConfigs =
        await this.positionRateConfigService.findAllUnpaginated();
      const existingPositions = new Set(existingConfigs.map((c) => c.position));

      const newPositions = hubspotPositions.filter(
        (p) => !existingPositions.has(p),
      );

      if (newPositions.length === 0) {
        console.log('syncPositionsFromHubspot: no new positions found.');
        return true;
      }

      for (const position of newPositions) {
        await this.prisma.positionRateConfig.create({
          data: {
            position,
            medVirtual_margin_per_hour: 9,
            berryVirtual_margin_per_hour: 9,
          },
        });
        console.log(
          `syncPositionsFromHubspot: created new position "${position}"`,
        );
      }

      const emailBody = newPositionsAlert(newPositions);
      await this.mailService.sendMail({
        from: 'MedVirtual <noreply@medvirtual.ai>',
        to: 'shayan@regenta.ai',
        cc: ['paulo@regenta.ai'],
        subject: '[Action Required] New VA Positions Found',
        html: emailBody,
      });

      console.log(
        `syncPositionsFromHubspot: alert sent for ${newPositions.length} new position(s).`,
      );
      return true;
    } catch (error) {
      console.error('Error in syncPositionsFromHubspot:', error);
      return false;
    }
  }

  async createQuarterlyPayoutRequests(): Promise<{
    created: number;
    failed: number;
    total_amount: string;
  }> {
    const runAt = new Date();
    console.log('Starting createQuarterlyPayoutRequests cron job...');

    const affiliates = await this.prisma.affiliateProfile.findMany({
      where: { commissions: { some: { status: 'eligible' } } },
      select: {
        id: true,
        full_name: true,
        user: { select: { email: true, first_name: true, last_name: true } },
        commissions: {
          where: { status: 'eligible' },
          select: { id: true, commission_amount: true },
        },
      },
    });

    console.log(
      `createQuarterlyPayoutRequests: found ${affiliates.length} affiliate(s) with eligible commissions.`,
    );

    const successes: PayoutReportEntry[] = [];
    const failures: PayoutReportFailure[] = [];

    for (const affiliate of affiliates) {
      const affiliateName =
        affiliate.full_name ??
        (affiliate.user
          ? `${affiliate.user.first_name} ${affiliate.user.last_name}`.trim()
          : affiliate.id);
      const affiliateEmail = affiliate.user?.email ?? '';
      const commissionIds = affiliate.commissions.map((c) => c.id);

      try {
        const result = await this.payoutRequestsService.createFromCron(
          affiliate.id,
          commissionIds,
        );

        successes.push({
          affiliateName,
          affiliateEmail,
          commissionCount: commissionIds.length,
          totalAmount: result.requested_amount.toString(),
          payoutRequestId: result.id,
        });

        console.log(
          `createQuarterlyPayoutRequests: created payout request ${result.id} for affiliate ${affiliate.id}`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        failures.push({ affiliateName, affiliateEmail, error: errorMessage });
        console.error(
          `createQuarterlyPayoutRequests: failed for affiliate ${affiliate.id} — ${errorMessage}`,
        );
      }
    }

    const totalAmount = successes
      .reduce((sum, s) => sum + parseFloat(s.totalAmount), 0)
      .toFixed(2);

    await this.mailService.sendMail({
      from: 'MedVirtual <noreply@medvirtual.ai>',
      to: ['paulo@regenta.ai', 'pauli@regenta.ai'],
      subject: `Quarterly Payout Report — ${runAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      html: quarterlyPayoutReport(successes, failures, runAt),
    });

    console.log(
      `createQuarterlyPayoutRequests: done. Created=${successes.length}, Failed=${failures.length}, Total=$${totalAmount}`,
    );

    return {
      created: successes.length,
      failed: failures.length,
      total_amount: totalAmount,
    };
  }

  /**
   * Daily cron: promotes referred companies from 'deployed' to 'eligible' after 30 days,
   * and promotes their 'detected' commissions to 'pending_admin_confirmation'.
   * Safe to re-run — already-eligible companies are excluded by the where clause.
   */
  async syncGrowthPartnersFromHubspot(): Promise<{
    created: number;
    skipped: number;
    failed: number;
    errors: string[];
  }> {

    const createdIds: string[] = [];
    const skippedIds: string[] = [];
    const errors: string[] = [];

    const properties = [
      'growth_partner_name',
      'growth_partner_email_address',
      'hs_pipeline',
      'hs_pipeline_stage',
      'business_unit',
      'alliance_commission',
    ];

    // Paginate through all Growth Partners in HubSpot
    let after: string | undefined;
    const allGrowthPartners: any[] = [];
    do {
      const body: any = {
        properties,
        limit: 100,
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'hs_pipeline',
                operator: 'EQ',
                value: '883841953',
              },
            ],
          },
        ],
      };
      if (after) body.after = after;

      const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/p20630393_growth_partners/search',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      allGrowthPartners.push(...response.data.results);
      after = response.data.paging?.next?.after;
    } while (after);

    console.log(
      `syncGrowthPartnersFromHubspot: found ${allGrowthPartners.length} Growth Partner(s) in HubSpot`,
    );

    for (const gp of allGrowthPartners) {
      const hubspotId = String(gp.id);
      const props = gp.properties ?? {};

      try {
        // Already synced — skip
        const existing = await this.prisma.affiliateProfile.findUnique({
          where: { hubspot_id: hubspotId },
        });
        if (existing) {
          skippedIds.push(hubspotId);
          continue;
        }

        // Resolve email and name from GP properties first
        let email: string | null = props.growth_partner_email_address ?? null;
        const fullName: string = props.growth_partner_name ?? '';
        const nameParts = fullName.trim().split(' ');
        let firstName = nameParts[0] ?? '';
        let lastName = nameParts.slice(1).join(' ') || '';

        // If no email on the GP object, try the associated contact
        if (!email) {
          try {
            const assocRes = await axios.get(
              `https://api.hubapi.com/crm/v3/objects/p20630393_growth_partners/${hubspotId}/associations/contacts`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                  'Content-Type': 'application/json',
                },
              },
            );

            const contactId = assocRes.data.results?.[0]?.id;
            if (contactId) {
              const contactRes = await axios.get(
                `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=email,firstname,lastname`,
                {
                  headers: {
                    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                  },
                },
              );
              const cp = contactRes.data.properties ?? {};
              email = cp.email ?? null;
              firstName = cp.firstname || firstName;
              lastName = cp.lastname || lastName;
            }
          } catch (contactErr: any) {
            console.warn(
              `syncGrowthPartnersFromHubspot: could not fetch contact for GP ${hubspotId} — ${contactErr?.message}`,
            );
          }
        }

        if (!email) {
          const msg = `GP ${hubspotId} (${fullName || 'unknown'}): no email found — skipped`;
          console.warn(`syncGrowthPartnersFromHubspot: ${msg}`);
          errors.push(msg);
          continue;
        }

        await this.prisma.$transaction(async (tx) => {
          // Reuse existing USER if the email is already in the system
          let user = await tx.uSER.findUnique({ where: { email } });

          // If user already has a profile, just stamp the hubspot_id if missing
          const profileExists = await tx.affiliateProfile.findUnique({
            where: { hubspot_id: hubspotId },
          });
          if (profileExists)  return;

          await tx.affiliateProfile.create({
            data: {
              user_id: user ? user.id : null,
              hubspot_id: hubspotId,
              full_name: fullName || null,
              commission_percent_default: props.alliance_commission
                ? Number(props.alliance_commission)
                : 7,
              hubspot_pipeline: props.hs_pipeline ?? null,
              hubspot_pipeline_stage: props.hs_pipeline_stage ?? null,
              business_unit: props.business_unit ?? null,
              status: AffiliateStatus.pending,
            },
          });
        });

        createdIds.push(hubspotId);
        console.log(
          `syncGrowthPartnersFromHubspot: created affiliate profile for GP ${hubspotId} (${email})`,
        );
      } catch (err: any) {
        const msg = `GP ${hubspotId}: ${err?.message ?? err}`;
        console.error(`syncGrowthPartnersFromHubspot: error — ${msg}`);
        errors.push(msg);
      }
    }

    console.log(
      `syncGrowthPartnersFromHubspot: created=${createdIds.length}, skipped=${skippedIds.length}, failed=${errors.length}`,
    );

    return {
      created: createdIds.length,
      skipped: skippedIds.length,
      failed: errors.length,
      errors,
    };
  }

  async promoteDeployedCompanies(): Promise<{
    companiesPromoted: number;
    commissionsPromoted: number;
    errors: string[];
  }> {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);
    const oneYearAgo = new Date(now.getTime() - ONE_YEAR_MS);

    const orgs = await this.prisma.organization.findMany({
      where: {
        referral_stage: 'deployed' as any,
        eligibility_start_at: { lte: thirtyDaysAgo, gte: oneYearAgo },
        med_alliance_referral_status: 'not_eligible',
      },
      select: { id: true, name: true, eligibility_start_at: true },
    });

    let companiesPromoted = 0;
    let commissionsPromoted = 0;
    const errors: string[] = [];
    const promotedEntries: PromotedCompanyEntry[] = [];

    for (const org of orgs) {
      try {
        await this.prisma.organization.update({
          where: { id: org.id },
          data: {
            med_alliance_referral_status: 'eligible',
            med_alliance_block_reason: null,
          },
        });
        await this.prisma.medAllianceAuditLog.create({
          data: {
            entity_type: 'referred_company',
            entity_id: org.id,
            event: 'eligibility_activated',
            old_status: 'not_eligible',
            new_status: 'eligible',
            reason: '30-day deployment window elapsed',
            source: 'cron',
            actor_user_id: null,
            metadata: {
              eligibility_start_at: org.eligibility_start_at?.toISOString(),
            } as any,
          },
        });
        companiesPromoted++;

        const detected = await this.prisma.affiliateCommission.findMany({
          where: { organization_id: org.id, status: 'detected' },
          select: { id: true },
        });
        for (const commission of detected) {
          await this.prisma.affiliateCommission.update({
            where: { id: commission.id },
            data: { status: 'pending_admin_confirmation' },
          });
          await this.prisma.medAllianceAuditLog.create({
            data: {
              entity_type: 'commission',
              entity_id: commission.id,
              event: 'status_changed',
              old_status: 'detected',
              new_status: 'pending_admin_confirmation',
              reason:
                '30-day deployment window elapsed — promoted for admin review',
              source: 'cron',
              actor_user_id: null,
              metadata: { organization_id: org.id } as any,
            },
          });
          commissionsPromoted++;
        }

        promotedEntries.push({
          orgId: org.id,
          orgName: org.name ?? org.id,
          eligibilityStartAt: org.eligibility_start_at
            ? org.eligibility_start_at.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : 'N/A',
          commissionsPromoted: detected.length,
        });
      } catch (err: any) {
        const msg = `Failed to promote org ${org.id}: ${err?.message ?? err}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    console.log(
      `promoteDeployedCompanies: companies=${companiesPromoted}, commissions=${commissionsPromoted}, errors=${errors.length}`,
    );

    if (companiesPromoted > 0) {
      try {
        await this.mailService.sendMail({
          from: 'MedVirtual <noreply@medvirtual.ai>',
          to: ['paulo@regenta.ai', 'pauli@regenta.ai'],
          subject: `Med Alliance — Deployed Companies Report (${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`,
          html: medAllianceDeployedCompaniesReport(
            promotedEntries,
            errors,
            now,
          ),
        });
      } catch (mailError) {
        console.error(
          'promoteDeployedCompanies: failed to send report email:',
          mailError,
        );
      }
    }

    return { companiesPromoted, commissionsPromoted, errors };
  }
}
