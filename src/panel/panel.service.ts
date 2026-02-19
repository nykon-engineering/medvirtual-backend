import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HireRequestStatus, OrganizationStatus, PanelCandidateStatus, PanelStatus } from '@prisma/client';
import { findHourlySalary, findMonthlySalary } from '../common/utils/salary.util';
import { changeLabelAvailability } from '../common/utils/hubspot.util';
import { dbToStageDictionary } from '../common/dictionaries/stage-dictionary';
import { activePipelines } from '../common/constant/activeDealPipelines';

@Injectable()
export class PanelService {

    constructor(
        private readonly prisma: PrismaService
    ){}

    async getPanelData(dateFrom?: string, dateTo?: string): Promise<any> {

        const dateFilterCreated: any = {};
        if (dateFrom) dateFilterCreated.gte = new Date(dateFrom);
        if (dateTo) dateFilterCreated.lte = new Date(dateTo);


        const selectCandidates = {
            id: true,
            first_name: true,
            last_name: true,
            name: true,
            email: true,
            country: true,
            employment_type: true,
            hourly_pay_rate: true,
            years_of_experience: true,
            pipeline_status: true,
            about_me: true,
            specialization: true,
            tools: true,
            medical_tools: true,
            gender: true,
            hubspot_id: true,
            headshot_url: true,
            processing_error: true,
            avatar_url: true,
            languages: {
                select: {
                name: true,
                }
            },
            skills: {
                select: {
                skill_name: true,
                skill_type: true
                }
            },
            educations: {
                select: {
                institution: true,
                degree: true,
                year: true
                }
            },
            approved_positions_pairing: true,
            experiences: {
                orderBy: { start_date: 'desc' as const },
                select: {
                company: true,
                position: true,
                start_date: true,
                end_date: true,
                responsabilities: true
                }
            },
            panelCandidates: {
                select:{
                id: true,
                panel:{
                    select:{
                    hire_request_id: true,
                        hireRequest:{
                            select:{
                            id: true,
                            title: true,
                            organization:{
                                select:{
                                id: true,
                                name: true,
                                }
                            }
                            }
                        },
                        interviews:{
                            select:{
                                id: true
                            }
                        }
                    }
                }
                }
            }
        }

        const result: any = {};

        // New Metrics Implementation

        // 1. Number of Active Client users (system users excluded)
        const activeClientUsers = await this.prisma.uSER.count({
            where: {
                role: {
                    in: ['organization_admin', 'organization_super_admin']
                },
                status: 'active',
                ...(dateTo ? { createdAt: { lte: new Date(dateTo) } } : {})
            }
        });
        result.activeClientUsers = activeClientUsers;

        // 2. Number of Verified Client users
        const verifiedClientUsers = await this.prisma.uSER.count({
            where: {
                role: {
                    in: ['organization_admin', 'organization_super_admin']
                },
                verified: true,
                ...(dateTo ? { createdAt: { lte: new Date(dateTo) } } : {})
            }
        });
        result.verifiedClientUsers = verifiedClientUsers;

        // 3. Average Ticket Aging (Hire Request Created → Placement Completed)
        
        const decidedDateFilter: any = {};
        if (dateFrom) decidedDateFilter.gte = new Date(dateFrom);
        if (dateTo) decidedDateFilter.lte = new Date(dateTo);
        const hasDecidedDateFilter = Object.keys(decidedDateFilter).length > 0;

        const completedHireRequests = await this.prisma.hireRequest.findMany({
            where: {
                status: HireRequestStatus.placement_completed,
                panels: {
                    some: {
                        status: PanelStatus.decision_made,
                        // Apply date filter to decided_date
                        ...(hasDecidedDateFilter ? { decided_date: decidedDateFilter } : {})
                    }
                }
            },
            select: {
                createdAt: true,
                panels: {
                    where: {
                        status: PanelStatus.decision_made,
                        // Select the panel that matches the date criteria
                        ...(hasDecidedDateFilter ? { decided_date: decidedDateFilter } : {})
                    },
                    select: {
                        decided_date: true
                    },
                    take: 1
                }
            }
        });

        let totalAgingDays = 0;
        let validRequestsCount = 0;

        if (completedHireRequests.length > 0) {
            totalAgingDays = completedHireRequests.reduce((acc, req) => {
                const decisionDate = req.panels[0]?.decided_date;
                // If for some reason we rely on 'updatedAt' fallback or skip
                // Since we filtered by having panels, strictly we should have one.
                if (!decisionDate) return acc;
                
                const diffTime = Math.abs(decisionDate.getTime() - req.createdAt.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                validRequestsCount++;
                return acc + diffDays;
            }, 0);
            
            result.averageTicketAging = validRequestsCount > 0 
                ? Number((totalAgingDays / validRequestsCount).toFixed(2)) 
                : 0;
        } else {
            result.averageTicketAging = 0;
        }

        // 4. Number of Hire Requests submitted by Client users
        const hrSubmittedByClient = await this.prisma.hireRequest.count({
            where: {
                createdBy: {
                    role: {
                        in: ['organization_admin', 'organization_super_admin']
                    }
                },
                ...(Object.keys(dateFilterCreated).length > 0 ? { createdAt: dateFilterCreated } : {})
            }
        });
        result.hrSubmittedByClient = hrSubmittedByClient;


        const organizationsCount = await this.prisma.organization.count({
            where:{
                status: OrganizationStatus.active
            }
        })
        result.activeOrganizations = organizationsCount;

        const usersCount = await this.prisma.uSER.count({
            where:{
                status: 'active'
            }
        });
        result.activeUsers = usersCount;

        const HrCount = await this.prisma.hireRequest.count({
            where:{
                status:{ not: HireRequestStatus.cancelled}
            }
        })
        result.activeHireRequests = HrCount;

        const staffCount = await this.prisma.staff.count({
            where:{
                status: 'active',
                hubspot_dealstage: { 
                    in: activePipelines.map(([key, _value]) => String(key))
                }
            }
        })
        result.activeStaff = staffCount;


        const candidatesAvailable = await this.prisma.candidate.count({
            where:{
                OR:[
                    { pipeline_status: '261075105'},
                    { pipeline_status: '1087596819'}
                ]
            }
        })
        result.candidatesAvailable = candidatesAvailable;

        /*const candidatesEndorsed = await this.prisma.candidate.count({
            where:{
                pipeline_status: '1172847191',
                panelCandidates: {
                    none:{
                        status:  PanelCandidateStatus.selected_by_client
                    }
                }
            }
        })*/

        const candidatesEndorsed = await this.prisma.candidate.count({
            where:{
                panelCandidates:{
                    some:{
                        panel:{
                            hireRequest:{
                                status: HireRequestStatus.awaiting_decision
                            }
                        }
                    }
                }
            }
        })

        result.candidatesEndorsed = candidatesEndorsed;

        const candidatesHired = await this.prisma.candidate.count({
            where: {
                panelCandidates: {
                some: {
                    status: PanelCandidateStatus.selected_by_client,
                    panel: {
                    hireRequest: {
                        status: { not: HireRequestStatus.deleted },
                    },
                    },
                },
                },
            },
            });

        result.candidatesHired = candidatesHired;

        const failedResumeParsing = await this.prisma.candidate.findMany({
            where: {
                pipeline_status: {
                    in: ['261075105', '1087596819'],
                },
                processing_status: 'failed',
                resume_url: { not: null },
            },
            select: selectCandidates
        });

        const failedResume = failedResumeParsing.map(candidate => ({
            ...candidate,
            employment_type: changeLabelAvailability(dbToStageDictionary[Number(candidate.employment_type)]) || candidate.employment_type,
            salary: findMonthlySalary(
                candidate.hourly_pay_rate?.toNumber() || 0,
                candidate.languages && candidate.languages.length > 1 ? 'Bilingual' : candidate.languages[0]?.name,
                candidate.approved_positions_pairing && candidate.approved_positions_pairing.length > 0 ? candidate.approved_positions_pairing[0] : '',
                candidate.employment_type || ''
            ),
            hourlySalary: candidate.hourly_pay_rate ? findHourlySalary(
                findMonthlySalary(
                    candidate.hourly_pay_rate?.toNumber() || 0,
                    candidate.languages && candidate.languages.length > 1 ? 'Bilingual' : candidate.languages[0]?.name,
                    candidate.approved_positions_pairing && candidate.approved_positions_pairing.length > 0 ? candidate.approved_positions_pairing[0] : '',
                    candidate.employment_type || ''
                ),
                candidate.employment_type || ''
            ) : 0,
            avatar: candidate.avatar_url ? `${process.env.AVATAR_URL}${candidate.avatar_url}` :  null,
            panelCandidates: candidate.panelCandidates ? candidate.panelCandidates.map(pc => ({
              title: pc.panel.hireRequest.title,
              organization_name: pc.panel.hireRequest.organization.name,
              status: 'test',
              
            })) : []
          }));
        result.failedResumeParsing = failedResume;

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
            select: selectCandidates
        });

        const CandwithoutHeadshot = withoutHeadshot.map(candidate => ({
            ...candidate,
            employment_type: changeLabelAvailability(dbToStageDictionary[Number(candidate.employment_type)]) || candidate.employment_type,
            salary: findMonthlySalary(
                candidate.hourly_pay_rate?.toNumber() || 0,
                candidate.languages && candidate.languages.length > 1 ? 'Bilingual' : candidate.languages[0]?.name,
                candidate.approved_positions_pairing && candidate.approved_positions_pairing.length > 0 ? candidate.approved_positions_pairing[0] : '',
                candidate.employment_type || ''
            ),
            hourlySalary: candidate.hourly_pay_rate ? findHourlySalary(
                findMonthlySalary(
                    candidate.hourly_pay_rate?.toNumber() || 0,
                    candidate.languages && candidate.languages.length > 1 ? 'Bilingual' : candidate.languages[0]?.name,
                    candidate.approved_positions_pairing && candidate.approved_positions_pairing.length > 0 ? candidate.approved_positions_pairing[0] : '',
                    candidate.employment_type || ''
                ),
                candidate.employment_type || ''
            ) : 0,
            avatar: candidate.avatar_url ? `${process.env.AVATAR_URL}${candidate.avatar_url}` :  null,
            panelCandidates: candidate.panelCandidates ? candidate.panelCandidates.map(pc => ({
              title: pc.panel.hireRequest.title,
              organization_name: pc.panel.hireRequest.organization.name,
              status: 'test',
              
            })) : []
          }));
        result.withoutHeadshot = CandwithoutHeadshot;


        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
       
        for (let i = 11; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            
            const candidatesCreated = await this.prisma.candidate.count({
                where: {
                    createdAt: {
                        gte: new Date(date.getFullYear(), date.getMonth(), 1),
                        lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
                    },
                    pipeline_status:{ in: ['261075105', '1087596819']}
                },
            });

            const hireRequestsCreated = await this.prisma.hireRequest.count({
                where: {
                    createdAt: {
                        gte: new Date(date.getFullYear(), date.getMonth(), 1),
                        lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
                    },
                },
            });

            const hireRequestsEndorsed = await this.prisma.hireRequest.count({
                where:{
                    status: HireRequestStatus.placement_completed,
                    panels: {
                        some: {
                            status: PanelStatus.decision_made,
                            decided_date: {
                                gte: new Date(date.getFullYear(), date.getMonth(), 1),
                                lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
                            },
                        },
                    },
                }
            })

            const interviewsScheduled = await this.prisma.interview.count({
                where: {
                    scheduled_date: {
                        gte: new Date(date.getFullYear(), date.getMonth(), 1),
                        lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
                    },
                },
            });

            if(!result.monthlyData) result.monthlyData = [];
            
           
            result.monthlyData.push({
                //monthName
                month: date.toLocaleString('default', { month: 'short' }),
                candidates: candidatesCreated,
                hireRequests_created: hireRequestsCreated,
                hireRequests_endorsed: hireRequestsEndorsed,
                interviews: interviewsScheduled,
            });
        }


       
        for (let i = 11; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            const newClients = await this.prisma.organization.count({
                where: {
                    createdAt: {
                        gte: new Date(date.getFullYear(), date.getMonth(), 1),
                        lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
                    },
                },
            });

            if(!result.newClients) result.newClients = [];

            result.newClients.push({
                month: date.toLocaleString('default', { month: 'short' }),
                newClients: newClients,
            });
        }

        for (let i = 11; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);

            const accessUsers = await this.prisma.session.count({
                where: {
                    createdAt: {
                        gte: new Date(date.getFullYear(), date.getMonth(), 1),
                        lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
                    },
                },
            });

            if(!result.userAccess) result.userAccess = [];
            result.userAccess.push({
                month: date.toLocaleString('default', { month: 'short' }),
                accessUsers: accessUsers,
            });
        }


        const candidatesWithInterviews = await this.prisma.candidate.findMany({
            where:{
                panelCandidates:{
                    some:{
                        panel:{
                            interviews:{
                                some:{}
                            }
                        }
                    }
                }
            },
            select: selectCandidates
        });

        const processed = candidatesWithInterviews.map(candidate => ({
            ...candidate,
            employment_type: changeLabelAvailability(dbToStageDictionary[Number(candidate.employment_type)]) || candidate.employment_type,
            salary: findMonthlySalary(
                candidate.hourly_pay_rate?.toNumber() || 0,
                candidate.languages && candidate.languages.length > 1 ? 'Bilingual' : candidate.languages[0]?.name,
                candidate.approved_positions_pairing && candidate.approved_positions_pairing.length > 0 ? candidate.approved_positions_pairing[0] : '',
                candidate.employment_type || ''
            ),
            hourlySalary: candidate.hourly_pay_rate ? findHourlySalary(
                findMonthlySalary(
                    candidate.hourly_pay_rate?.toNumber() || 0,
                    candidate.languages && candidate.languages.length > 1 ? 'Bilingual' : candidate.languages[0]?.name,
                    candidate.approved_positions_pairing && candidate.approved_positions_pairing.length > 0 ? candidate.approved_positions_pairing[0] : '',
                    candidate.employment_type || ''
                ),
                candidate.employment_type || ''
            ) : 0,
            avatar: candidate.avatar_url ? `${process.env.AVATAR_URL}${candidate.avatar_url}` :  null,
            panelCandidates: candidate.panelCandidates ? candidate.panelCandidates.map(pc => ({
              title: pc.panel.hireRequest.title,
              organization_name: pc.panel.hireRequest.organization.name,
              status: 'test',
            })) : [],
            interviewCount: candidate.panelCandidates.reduce((total, pc) => {
                const count = pc.panel.interviews.length;
                return total + count;
              }, 0)

          }));

        result.moreThan5Interviews = processed.filter(c => c.interviewCount > 5);

        return result;
    }
}