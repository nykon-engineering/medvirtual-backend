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
import { MailService } from '../mail/mail.service';
import { activePipelines } from '../common/constant/activeDealPipelines';
import { HireRequestService } from '../hire-request/hire-request.service';
import { PositionRateConfigService } from '../position-rate-config/position-rate-config.service';

type Event = {
    objectId?: string;
}


@Injectable()
export class CronService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly candidate: CandidatesService,
        private readonly objectCreation: HandlerObjectCreation,
        private readonly mailService: MailService,
        private readonly hireRequestService: HireRequestService,
        private readonly positionRateConfigService: PositionRateConfigService,
    ){}

    
    async reRunPipeline(statusDto: reRunPipelineDto): Promise<boolean> {
        //return false; 
        const {status} = statusDto
        const candidates= await this.prisma.candidate.findMany({
            where: {
                processing_status: status === 'failed' ? { not: 'completed' }: status,
                AND: [
                    { resume_url: { not: null } },
                    { resume_url: { not: 'To Follow' } },
                    { resume_url: { not: 'To follow' } },
                    { resume_url: { not: 'N/A' } },
                ]
            },
            select: {
                id: true,
                first_name: true,
                last_name: true,
            },
            orderBy: {
                processed_at: 'desc'
            },
        })

        if (process.env.ENVIRONMENT === 'PROD') {
            for( const candidate of candidates) {
                console.log(`Re-running pipeline for candidate ID: ${candidate.id}, Name: ${candidate.first_name} ${candidate.last_name}`);
                try{
                    await this.candidate.processData(candidate.id);
                    console.log(`===>Finished Pipeline for the candidate ID: ${candidate.id}`);
                }catch{
                    await this.prisma.candidate.update({
                        where: { id: candidate.id },
                        data: {
                            processing_status: 'failed'
                        },
                    });
                    console.log(`===>Error in Pipeline for the candidate ID: ${candidate.id}`);
                }
            
            }
        }else{
            console.log('Environment is not PROD. Skipping re-run of pipelines.');
        }
        return true;
    }

    async getCandidateId(): Promise<boolean> {
        console.log('Starting getCandidateId cron job...');
        const staffs = await this.prisma.staff.findMany({
            where: {
                candidate_id: null,
                hubspot_id: { not: null }
            },
            select: {
                id: true,
                hubspot_id: true,
            }
        });

        for(const staff of staffs) {
            let event: Event = {};
            const getObjectVA = await axios.get(`https://api.hubapi.com/crm/v3/objects/deals/${staff.hubspot_id}/associations/${process.env.HUBSPOT_CUSTOM_OBJECT}`,
                {
                headers: {
                    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                    },
                });
                //console.log('getObjectVA: ', getObjectVA.data);
    
                if (getObjectVA?.data?.results?.length > 0) {
                    let candidateExists = await this.prisma.candidate.findUnique({
                        where: {
                            hubspot_id: String(getObjectVA.data.results[0].id)
                        },
                        select: {
                            id: true,
                        }
                    })

                    if (!candidateExists) {
                        event.objectId = getObjectVA.data.results[0].id;
                        //=> call the candidate creation service
                        await this.objectCreation.execute(event);

                        candidateExists = await this.prisma.candidate.findUnique({
                            where: {
                                hubspot_id: String(getObjectVA.data.results[0].id)
                            },
                            select: {
                                id: true,
                            }
                        })
                    } 

    
                    await this.prisma.staff.update({
                        where: { id: staff.id },
                        data: {
                            hubspot_candidate_id: String( getObjectVA.data.results[0].id ),
                            candidate_id: candidateExists ? candidateExists.id : null,
                        }
                    })
                    
                }
                   
        }
        await this.prisma.sync.create({
            data: {
                role: 'get-candidate-id',
                last_synced_at: new Date(),
            }
        })
        return true;
    }


    async systemReport(): Promise<boolean> {
        try {
            const availableCandidates = await this.prisma.candidate.count({
                where: {
                    OR: [
                        { pipeline_status: '261075105', },
                        { pipeline_status: '1087596819', },
                    ],
                }
            });

            const endorsedCandidates = await this.prisma.candidate.count({
                where: {
                    pipeline_status: '1172847191',
                }
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
                }
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
                }
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
                }
            });


            const emailBody = systemReport(availableCandidates, endorsedCandidates, withoutResume, failedResumeParsing, withoutHeadshot);
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
                        }
                    }
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
                        }
                    }
                }
            });

            console.log(`Inactive clients Found:`, inactiveClients);

            //update them for active    
            await Promise.all(inactiveClients.map(async (client) => {
                console.log(`Updating client ${client.name} (ID: ${client.id}) to active status.`);
                await this.prisma.organization.update({
                    where: { id: client.id },
                    data: {
                        status: 'active',
                    }
                });
            }));


            return true
        }catch (error) {
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
            const orgNameById = Object.fromEntries(clientsWithNoActiveStaff.map((org) => [org.id, org.name]));
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

            console.log(`Found ${invitedUsersToDelete.length} invited users to delete.`);

            for (const user of invitedUsersToDelete) {
                await this.prisma.$transaction(async (tx) => {
                    await tx.emailVerification.deleteMany({ where: { userId: user.id } });
                    await tx.emailInvitation.deleteMany({ where: { userId: user.id } });
                    await tx.uSER.delete({ where: { id: user.id } });
                });
                console.log(`Deleted invited user: ${user.email}`);
            }

            // Send report email
            const toReportUser = (u: typeof usersToDeactivate[number]) => ({
                email: u.email,
                first_name: u.first_name,
                last_name: u.last_name,
                organization_name: u.organization_id ? (orgNameById[u.organization_id] ?? 'N/A') : 'N/A',
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
                const emailBody = cronJobErrorReport('deactivate-client-users-no-staff', error, new Date());
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
                }
            });

            for (const staff of staffs) {
                try {
                    const response = await axios.get(`https://api.hubapi.com/crm/v3/objects/deals/${staff.hubspot_id}`,
                        {
                            headers: {
                                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                                'Content-Type': 'application/json',
                            },
                        });

                    const dealstage = response.data.properties.dealstage;

                    await this.prisma.staff.update({
                        where: { id: staff.id },
                        data: {
                            hubspot_dealstage: dealstage,
                            status: activePipelines.some(([key]) => key === dealstage) ? 'active' : 'inactive',
                        }
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
            const hubspotPositions: string[] = hubspotOptions.map((opt: { label: string }) => opt.label);

            const existingConfigs = await this.positionRateConfigService.findAllUnpaginated();
            const existingPositions = new Set(existingConfigs.map((c) => c.position));

            const newPositions = hubspotPositions.filter((p) => !existingPositions.has(p));

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
                console.log(`syncPositionsFromHubspot: created new position "${position}"`);
            }

            const emailBody = newPositionsAlert(newPositions);
            await this.mailService.sendMail({
                from: 'MedVirtual <noreply@medvirtual.ai>',
                to: 'shayan@regenta.ai',
                cc: ['paulo@regenta.ai'],
                subject: '[Action Required] New VA Positions Found',
                html: emailBody,
            });

            console.log(`syncPositionsFromHubspot: alert sent for ${newPositions.length} new position(s).`);
            return true;
        } catch (error) {
            console.error('Error in syncPositionsFromHubspot:', error);
            return false;
        }
    }

}
