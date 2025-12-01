import { BadRequestException, forwardRef, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HubspotService } from "../hubspot.service";

@Injectable()
export class HandlerTicketDeletion {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(forwardRef(() => HubspotService))
        private readonly hubspot: HubspotService,
    ){}

    async execute(event){
        try {
            
            
            const ticketExists = await this.prisma.hireRequest.findUnique({
                where: {
                    hubspot_ticket_id: String(event.objectId)
                },
                select: {
                    id: true,
                    status: true,
                    panels:{
                        select:{
                            panelCandidates:{
                                select:{
                                    candidate:{
                                        select:{
                                            id:true,
                                            pipeline_status:true,
                                            pipeline_status_origin:true,
                                            hubspot_id:true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            })
            if(!ticketExists) return;


            const candidatesToUpdate = ticketExists.panels.flatMap(panel =>
                panel.panelCandidates.map(pc => pc.candidate)
            );

            console.log('Candidates to update:', candidatesToUpdate);
            
            await Promise.all(
                candidatesToUpdate.map(async c =>{
                    await this.prisma.candidate.update({
                    where: { id: c.id },
                    data: { pipeline_status: c.pipeline_status_origin || c.pipeline_status},
                    });
                    await this.hubspot.updateOneCandidateFromHireRequest(c.hubspot_id, c.pipeline_status_origin || c.pipeline_status);
                })
            );

            //=> here I'm updating the hire request status to 'deleted' instead of deleting because I want to save this panel info for future references. for example for restore tickets
            await this.prisma.hireRequest.update({
                where: {
                    id: ticketExists.id
                },
                data: {
                    old_status: ticketExists.status,
                    status: 'deleted',
                }
            });

            //=> Here I 'll remove all candidates from the ticket panels
            await this.prisma.candidatePanel.deleteMany({
                where:{
                    hire_request_id: ticketExists.id
                }
            });

            
        }catch (error) {
            throw new BadRequestException('Error deleting ticket', error);
        }
        
    }
}