import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { reRunPipelineDto } from './dto/re-run-pipeline.dto';
import { CandidatesService } from '../candidate/candidates.service';

@Injectable()
export class CronService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly candidate: CandidatesService
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


}
