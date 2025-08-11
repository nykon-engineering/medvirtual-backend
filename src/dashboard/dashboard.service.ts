import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { USER } from '@prisma/client';

@Injectable()
export class DashboardService {

    constructor(
        private readonly prisma: PrismaService,
    ) {}
              

    async getDashboardData(user: USER): Promise<any> {
        let result: any = {};

        if (!user || !user.organization_id) throw new BadRequestException('User or organization not found');
        //hired staff
        const hiredStaff = await this.prisma.candidate.findMany({
            where:{
                organization_id: user.organization_id,
            }
        })
        result.hiredStaff = hiredStaff;

        //awaiting decision panels
        const hireRequest = await this.prisma.hireRequest.findMany({
            where: {
                org_id: user.organization_id,
                status: 'awaiting_decision',
            },select:{
                id: true,
                title: true,
                description: true,
                requirements: true,
                status: true,
                priority: true,
                createdAt: true,
                panels: {
                    select: {
                        id:true,
                        status: true,
                        scheduled_date: true,
                        createdAt: true,
                    }
                }
            }
        })
        result.hireRequest = hireRequest;



        const hireRequest2 = await this.prisma.hireRequest.findMany({
            where: {
                org_id: user.organization_id,
                status: 'awaiting_decision',
            },
            select:{
                id: true,
                title: true,
                description: true,
                requirements: true,
                status: true,
                priority: true,
                createdAt: true,
                panels: {
                    select: {
                    id:true,
                    status: true,
                    scheduled_date: true,
                    createdAt: true,
                    panelCandidates:{
                        select: {
                            id: true,
                            candidate: {
                                select: {
                                    id: true,
                                    first_name: true,
                                    last_name: true,
                                    email: true,
                                    hourly_pay_rate: true,
                                    organization_id: true,
                                }
                            }
                        }
                    }
                    }
                }
            }
        });
        result.hireRequest2 = hireRequest2;

        
        //other talents in our pool
        const otherTalents = await this.prisma.candidate.findMany({
            where: {
                organization_id: null
            },
            orderBy:{
                createdAt: 'desc',
            },
            take: 8,
        });
        result.otherTalents = otherTalents;


        return result;
    }
}
