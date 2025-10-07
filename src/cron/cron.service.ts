import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { reRunPipelineDto } from './dto/re-run-pipeline.dto';
import { CandidatesService } from '../candidate/candidates.service';
import axios from 'axios';
import { HandlerObjectCreation } from '../hubspot/handlers/objectCreation';

type Event = {
    objectId?: string;
}


@Injectable()
export class CronService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly candidate: CandidatesService,
        private readonly objectCreation: HandlerObjectCreation
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
        return true;
    }


}
