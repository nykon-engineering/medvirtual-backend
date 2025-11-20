import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HireRequestStatus, OrganizationStatus } from '@prisma/client';
import { findMonthlySalary } from '../common/utils/salary.util';

@Injectable()
export class PanelService {

    constructor(
        private readonly prisma: PrismaService
    ){}

    async getPanelData(): Promise<any> {

        const result: any = {};

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
                status: 'active'
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

        const candidatesEndorsed = await this.prisma.candidate.count({
            where:{
                pipeline_status: '1172847191'
            }
        })
        result.candidatesEndorsed = candidatesEndorsed;


        result.candidatesHired = 0;

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
                email: true,
                country: true,
                employment_type: true,
                hourly_pay_rate: true,
                years_of_experience: true,
                pipeline_status: true, // This will be converted to name later
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
                    orderBy: { start_date: 'desc' },
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
                        }
                        }
                    }
                    }
                }
                
            }
        });

        const failedResume = failedResumeParsing.map(candidate => ({
            ...candidate,
            salary: findMonthlySalary(candidate.hourly_pay_rate?.toNumber() || 0),
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
            select: {
                id: true,
                first_name: true,
                last_name: true,
                name: true,
                email: true,
                country: true,
                employment_type: true,
                hourly_pay_rate: true,
                years_of_experience: true,
                pipeline_status: true, // This will be converted to name later
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
                    orderBy: { start_date: 'desc' },
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
                        }
                        }
                    }
                    }
                }
                
            }
        });

        const CandwithoutHeadshot = withoutHeadshot.map(candidate => ({
            ...candidate,
            salary: findMonthlySalary(candidate.hourly_pay_rate?.toNumber() || 0),
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
                hireRequests: hireRequestsCreated,
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




        return result;
    }
}