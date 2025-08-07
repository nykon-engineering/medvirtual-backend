import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { reRunPipelineDto } from './dto/re-run-pipeline.dto';

@Injectable()
export class CronService {
    constructor(
        private readonly prisma: PrismaService
    ){}


    async reRunPipeline(statusDto: reRunPipelineDto) {
        const {status} = statusDto
        console.log('Re-running pipeline for status:', status);
        const candidates= await this.prisma.candidate.findMany({
            where: {
                processing_status: status
            }
        })
    }

}
