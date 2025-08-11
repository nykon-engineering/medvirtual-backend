import { Controller, Get, Post, Query } from '@nestjs/common';
import { CronService } from './cron.service';
import { ApiProperty, ApiQuery } from '@nestjs/swagger';
import { reRunPipelineDto } from './dto/re-run-pipeline.dto';

@Controller('cron')
export class CronController {

    constructor(
        private readonly cron: CronService
    ) {}

    @Get()
    @ApiProperty({ description: 'Trigger the cron job to re-run pipeline of the candidates on processing' })
    @ApiQuery({ name: 'status', type: reRunPipelineDto, description: 'Status to filter candidates for re-running pipeline' })
    async reRunPipeline(@Query() status: reRunPipelineDto) {
        const result = await this.cron.reRunPipeline(status);
        return {
            status: 200,
            message: 'Pipeline re-run successfully',
            data: result
        }
    }

}
