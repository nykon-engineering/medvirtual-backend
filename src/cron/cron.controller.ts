import { Controller, Get, Query } from '@nestjs/common';
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
    @ApiQuery({ type: reRunPipelineDto })
    async reRunPipeline(@Query('status') statusDto: reRunPipelineDto) {
        const result = await this.cron.reRunPipeline(statusDto);
        return {
            status: 200,
            message: 'Pipeline re-run successfully',
            data: result
        }
    }
}
