import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HireRequestStatus, OrganizationStatus } from '@prisma/client';

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
                hubspot_id: true,
                processing_error: true,
            }
        });
        result.failedResumeParsing = failedResumeParsing;

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
                headshot_url: true,
            }
        });
        result.withoutHeadshot = withoutHeadshot;



        return result;
    }
}