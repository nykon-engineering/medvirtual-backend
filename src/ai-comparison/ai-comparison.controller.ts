import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AiComparisonService } from './ai-comparison.service';
import { CompareResumeDto } from './dto/compare-resume.dto';
import { CompareTextDto } from './dto/compare-text.dto';
import {
  ResumeComparisonResultDto,
  ResumeFromOpenRouterOnlyResultDto,
  TextSummaryComparisonResultDto,
} from './dto/comparison-result.dto';

@ApiTags('ai-comparison')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('system_super_admin', 'system_admin')
@Controller('ai-comparison')
export class AiComparisonController {
  constructor(private readonly aiComparison: AiComparisonService) {}

  @Post('resume')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Compare OpenAI and OpenRouter resume extraction side by side (dry run, writes nothing to the database). Each call consumes real OpenAI credits.',
  })
  @ApiResponse({
    status: 201,
    description: 'Both provider outputs plus a structured diff',
    type: ResumeComparisonResultDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Candidate not found' })
  async compareResume(
    @Body() dto: CompareResumeDto,
  ): Promise<ResumeComparisonResultDto> {
    return this.aiComparison.compareResume(dto);
  }

  @Post('text-summary')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Compare OpenAI and OpenRouter text summarization side by side (dry run). Each call consumes real OpenAI credits.',
  })
  @ApiResponse({
    status: 201,
    description: 'Both provider summaries plus a structured diff',
    type: TextSummaryComparisonResultDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async compareTextSummary(
    @Body() dto: CompareTextDto,
  ): Promise<TextSummaryComparisonResultDto> {
    return this.aiComparison.compareTextSummary(dto);
  }

  @Post('resume-from-openrouter-only')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Extract a resume using OpenRouter only (dry run, writes nothing to the database). Does not consume OpenAI credits, so it works while OpenAI is out of quota.',
  })
  @ApiResponse({
    status: 201,
    description: 'OpenRouter extraction result',
    type: ResumeFromOpenRouterOnlyResultDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Candidate not found' })
  async resumeFromOpenRouterOnly(
    @Body() dto: CompareResumeDto,
  ): Promise<ResumeFromOpenRouterOnlyResultDto> {
    return this.aiComparison.resumeFromOpenRouterOnly(dto);
  }
}
