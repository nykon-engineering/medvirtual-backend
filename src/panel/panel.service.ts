import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HireRequestStatus, OrganizationStatus, PanelCandidateStatus, PanelStatus } from '@prisma/client';
import { buildConfigMap, computeCandidateRates } from '../common/utils/salary.util';
import { changeLabelAvailability } from '../common/utils/hubspot.util';
import { PositionRateConfigService } from '../position-rate-config/position-rate-config.service';
import { dbToStageDictionary } from '../common/dictionaries/stage-dictionary';
import { activePipelines } from '../common/constant/activeDealPipelines';

@Injectable()
export class PanelService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly positionRateConfigService: PositionRateConfigService,
    ){}

    async getPanelData(dateFrom?: string, dateTo?: string): Promise<any> {

        const dateFilterCreated: any = {};
        if (dateFrom) dateFilterCreated.gte = new Date(dateFrom);
        if (dateTo) dateFilterCreated.lte = new Date(dateTo);
        const hasDateFilter = Object.keys(dateFilterCreated).length > 0;


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
                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {})
            }
        });
        result.activeClientUsers = activeClientUsers;

        // 2. Number of Verified Client users
        const invitedClientUsers = await this.prisma.uSER.count({
            where: {
                role: {
                    in: ['organization_admin', 'organization_super_admin']
                },
                status: 'invited',
                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {})
            }
        });
        result.invitedClientUsers = invitedClientUsers;

        // 3. Average Ticket Aging (Hire Request Created → Placement Completed)

        const decidedDateFilter: any = {};
        if (dateFrom) decidedDateFilter.gte = new Date(dateFrom);
        if (dateTo) decidedDateFilter.lte = new Date(dateTo);
        const hasDecidedDateFilter = Object.keys(decidedDateFilter).length > 0;

        const completedHireRequests = await this.prisma.hireRequest.findMany({
            where: {
                status: HireRequestStatus.placement_completed,
                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {}),
                panels: {
                    some: {
                        status: PanelStatus.decision_made,
                        ...(hasDecidedDateFilter ? { decided_date: decidedDateFilter } : {})
                    }
                }
            },
            select: {
                createdAt: true,
                panels: {
                    where: {
                        status: PanelStatus.decision_made,
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
                status: {not: { in: [HireRequestStatus.deleted, HireRequestStatus.cancelled] } },
                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {})
            }
        });
        result.hrSubmittedByClient = hrSubmittedByClient;


        const organizationsCount = await this.prisma.organization.count({
            where:{
                status: OrganizationStatus.active,
                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {})
            }
        })
        result.activeOrganizations = organizationsCount;

        const usersCount = await this.prisma.uSER.count({
            where:{
                status: 'active',
                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {})
            }
        });
        result.activeUsers = usersCount;

        const HrCount = await this.prisma.hireRequest.count({
            where:{
                status:{ not: { in: [HireRequestStatus.deleted, HireRequestStatus.cancelled] } },
                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {})
            }
        })
        result.activeHireRequests = HrCount;

        const staffCount = await this.prisma.staff.count({
            where:{
                status: 'active',
                hubspot_dealstage: {
                    in: activePipelines.map(([key, _value]) => String(key))
                },
                ...(hasDateFilter ? { created_at: dateFilterCreated } : {})
            }
        })
        result.activeStaff = staffCount;


        const candidatesAvailable = await this.prisma.candidate.count({
            where:{
                OR:[
                    { pipeline_status: '261075105'},
                    { pipeline_status: '1087596819'}
                ],
                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {})
            }
        })
        result.candidatesAvailable = candidatesAvailable;

        const candidatesEndorsed = await this.prisma.candidate.count({
            where:{
                panelCandidates:{
                    some:{
                        panel:{
                            hireRequest:{
                                status: HireRequestStatus.awaiting_decision,
                                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {})
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
                        ...(hasDateFilter ? { createdAt: dateFilterCreated } : {})
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
                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {})
            },
            select: selectCandidates
        });

        const positionConfigs = await this.positionRateConfigService.findAll();
        const configByPosition = buildConfigMap(positionConfigs);

        const failedResume = failedResumeParsing.map(candidate => {
            const rates = computeCandidateRates(candidate, configByPosition);
            return ({
            ...candidate,
            employment_type: changeLabelAvailability(dbToStageDictionary[Number(candidate.employment_type)]) || candidate.employment_type,
            ...rates,
            avatar: candidate.avatar_url ? `${process.env.AVATAR_URL}${candidate.avatar_url}` :  null,
            panelCandidates: candidate.panelCandidates ? candidate.panelCandidates.map(pc => ({
              title: pc.panel.hireRequest.title,
              organization_name: pc.panel.hireRequest.organization.name,
              status: 'test',

            })) : []
          });
        });
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
                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {})
            },
            select: selectCandidates
        });

        const CandwithoutHeadshot = withoutHeadshot.map(candidate => {
            const rates = computeCandidateRates(candidate, configByPosition);
            return {
              ...candidate,
              employment_type: changeLabelAvailability(dbToStageDictionary[Number(candidate.employment_type)]) || candidate.employment_type,
              ...rates,
              avatar: candidate.avatar_url ? `${process.env.AVATAR_URL}${candidate.avatar_url}` : null,
              panelCandidates: candidate.panelCandidates ? candidate.panelCandidates.map(pc => ({
                title: pc.panel.hireRequest.title,
                organization_name: pc.panel.hireRequest.organization.name,
                status: 'test',
              })) : []
            };
          });
        result.withoutHeadshot = CandwithoutHeadshot;


        // Monthly data: dynamic range based on dateFrom/dateTo, defaults to last 12 months
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        // Parse "YYYY-MM-DD" strings directly to avoid UTC-to-local timezone shift.
        // Using new Date("YYYY-MM-DD") parses as UTC midnight, and .getMonth()/.getFullYear()
        // return LOCAL values — on servers with negative UTC offset (e.g. UTC-3) this shifts
        // the date back one day, causing the wrong month to be used as loop start/end.
        const parseDateSafe = (dateStr: string): { year: number; month: number } => {
            const [y, m] = dateStr.split('-').map(Number);
            return { year: y, month: m - 1 }; // month is 0-indexed
        };

        let monthsToIterate: Date[] = [];
        if (dateFrom || dateTo) {
            const start = dateFrom
                ? (() => { const { year, month } = parseDateSafe(dateFrom); return new Date(year, month, 1); })()
                : new Date(currentYear, currentMonth - 11, 1);
            const end = dateTo
                ? (() => { const { year, month } = parseDateSafe(dateTo); return new Date(year, month, 1); })()
                : new Date(currentYear, currentMonth, 1);
            let cursor = new Date(start);
            while (cursor <= end) {
                monthsToIterate.push(new Date(cursor));
                cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
            }
        } else {
            for (let i = 11; i >= 0; i--) {
                monthsToIterate.push(new Date(currentYear, currentMonth - i, 1));
            }
        }

        for (const date of monthsToIterate) {
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);

            const candidatesCreated = await this.prisma.candidate.count({
                where: {
                    createdAt: { gte: monthStart, lt: monthEnd },
                    pipeline_status:{ in: ['261075105', '1087596819']}
                },
            });

            const hireRequestsCreated = await this.prisma.hireRequest.count({
                where: {
                    createdAt: { gte: monthStart, lt: monthEnd },
                },
            });

            const hireRequestsEndorsed = await this.prisma.hireRequest.count({
                where:{
                    status: HireRequestStatus.placement_completed,
                    panels: {
                        some: {
                            status: PanelStatus.decision_made,
                            decided_date: { gte: monthStart, lt: monthEnd },
                        },
                    },
                }
            })

            const interviewsScheduled = await this.prisma.interview.count({
                where: {
                    scheduled_date: { gte: monthStart, lt: monthEnd },
                },
            });

            if(!result.monthlyData) result.monthlyData = [];

            result.monthlyData.push({
                month: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
                candidates: candidatesCreated,
                hireRequests_created: hireRequestsCreated,
                hireRequests_endorsed: hireRequestsEndorsed,
                interviews: interviewsScheduled,
            });
        }


        for (const date of monthsToIterate) {
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);

            const newClients = await this.prisma.organization.count({
                where: {
                    createdAt: { gte: monthStart, lt: monthEnd },
                },
            });

            if(!result.newClients) result.newClients = [];

            result.newClients.push({
                month: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
                newClients: newClients,
            });
        }

        for (const date of monthsToIterate) {
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);

            const accessUsers = await this.prisma.session.count({
                where: {
                    createdAt: { gte: monthStart, lt: monthEnd },
                },
            });

            if(!result.userAccess) result.userAccess = [];
            result.userAccess.push({
                month: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
                accessUsers: accessUsers,
            });
        }


        const candidatesWithInterviews = await this.prisma.candidate.findMany({
            where:{
                ...(hasDateFilter ? { createdAt: dateFilterCreated } : {}),
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

        const processed = candidatesWithInterviews.map(candidate => {
            const rates = computeCandidateRates(candidate, configByPosition);
            return {
              ...candidate,
              employment_type: changeLabelAvailability(dbToStageDictionary[Number(candidate.employment_type)]) || candidate.employment_type,
              ...rates,
              avatar: candidate.avatar_url ? `${process.env.AVATAR_URL}${candidate.avatar_url}` : null,
              panelCandidates: candidate.panelCandidates ? candidate.panelCandidates.map(pc => ({
                title: pc.panel.hireRequest.title,
                organization_name: pc.panel.hireRequest.organization.name,
                status: 'test',
              })) : [],
              interviewCount: candidate.panelCandidates.reduce((total, pc) => {
                const count = pc.panel.interviews.length;
                return total + count;
              }, 0)
            };
          });

        result.moreThan5Interviews = processed.filter(c => c.interviewCount > 5);

        return result;
    }
}
