import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class HandlerOrganization  {
    constructor(
        private readonly prisma: PrismaService,
    ){}


    async execute(user): Promise<object> {
        let result: any = {};
        //this variable will be used to hiredStaff and otherTalents
        const select ={
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
            languages: {
              select: {
                name: true,
              }
            },
            skills: {
              select: {
                skill_name: true
              }
            },
            //educations and experiences doesnt to be necessary here
        }

        if (!user || !user.organization_id) throw new BadRequestException('User or organization not found');
        //hired staff
        const hiredStaff = await this.prisma.candidate.findMany({
            where:{
                organization_id: user.organization_id,
            },
            select
        })
        result.hiredStaff = hiredStaff;

        //awaiting decision panels
        const hireRequest = await this.prisma.hireRequest.findMany({
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
        result.hireRequest = hireRequest;

        
        //other talents in our pool
        const otherTalents = await this.prisma.candidate.findMany({
            where: {
                organization_id: null
            },
            select,
            orderBy:{
                createdAt: 'desc',
            },
            take: 8,
        });
        result.otherTalents = otherTalents;


        return result;
    }
}