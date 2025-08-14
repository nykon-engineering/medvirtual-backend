import { BadRequestException, Injectable } from '@nestjs/common';
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
        const {status} = statusDto
        const candidates= await this.prisma.candidate.findMany({
            where: {
                processing_status: status,
            },
            select: {
                id: true,
                first_name: true,
                last_name: true,
            }
        })

        for( const candidate of candidates) {
            console.log(`Re-running pipeline for candidate ID: ${candidate.id}, Name: ${candidate.first_name} ${candidate.last_name}`);
            await this.candidate.processData(candidate.id);
            console.log(`===>Finished Pipeline re-run for candidate ID: ${candidate.id}`);
        }
        return true;
    }


}
