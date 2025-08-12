import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()

export class HandlerClient {

    constructor(
        private readonly prisma: PrismaService,
    ){}

    async execute(user): Promise<object> {

        let result: any = {};

        if (!user || !user.organization_id) throw new Error('User or organization not found');

        

        result.newRequests = "";
        result.panelToSchedule = "";
        result.pendingDecisions = "";
        result.openTickets = "";

        //Hire Requests
        const hireRequest = await this.prisma.hireRequest.findMany({
            where: {
                org_id: user.organization_id,
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
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        result.hireRequest = hireRequest;

        return result;
    }
}