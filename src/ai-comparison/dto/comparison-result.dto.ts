import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProviderRunDto {
  @ApiProperty({
    description: 'Model that served the request',
    example: 'gpt-4o-mini',
  })
  model: string;

  @ApiProperty({ description: 'Whether the provider returned a usable result' })
  ok: boolean;

  @ApiProperty({
    description: 'Wall-clock latency in milliseconds',
    example: 8100,
  })
  latencyMs: number;

  @ApiProperty({ description: 'Cost in USD for this run', example: 0.0021 })
  cost: number;

  @ApiPropertyOptional({ description: 'Parsed output when the run succeeded' })
  data?: any;

  @ApiPropertyOptional({ description: 'Error message when the run failed' })
  error?: string;
}

export class NumericComparisonDto {
  @ApiProperty({ example: 5 })
  openai: number;

  @ApiProperty({ example: 4 })
  openrouter: number;

  @ApiProperty({ description: 'openai minus openrouter', example: 1 })
  delta: number;
}

export class ResumeDiffDto {
  @ApiProperty({ type: NumericComparisonDto })
  experienceCount: NumericComparisonDto;

  @ApiProperty({ type: NumericComparisonDto })
  educationCount: NumericComparisonDto;

  @ApiProperty({ type: NumericComparisonDto })
  skillsCount: NumericComparisonDto;

  @ApiProperty({ type: NumericComparisonDto })
  bioLength: NumericComparisonDto;

  @ApiProperty({
    description:
      'Fields present in the OpenAI output but empty/absent in OpenRouter',
    example: ['skills'],
    type: [String],
  })
  missingInOpenrouter: string[];

  @ApiProperty({
    description:
      'Fields present in the OpenRouter output but empty/absent in OpenAI',
    type: [String],
  })
  missingInOpenai: string[];

  @ApiProperty({
    description: 'openai cost minus openrouter cost',
    example: 0.0021,
  })
  costDelta: number;

  @ApiProperty({
    description: 'openai latency minus openrouter latency',
    example: -13300,
  })
  latencyDeltaMs: number;
}

export class ResumeComparisonResultDto {
  @ApiProperty({ example: 'b3f1c2d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d' })
  candidateId: string;

  @ApiProperty({
    description: 'Number of resume pages sent to both providers',
    example: 3,
  })
  pageCount: number;

  @ApiProperty({ type: ProviderRunDto })
  openai: ProviderRunDto;

  @ApiProperty({ type: ProviderRunDto })
  openrouter: ProviderRunDto;

  @ApiProperty({ type: ResumeDiffDto })
  diff: ResumeDiffDto;
}

export class ResumeFromOpenRouterOnlyResultDto {
  @ApiProperty({ example: 'b3f1c2d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d' })
  candidateId: string;

  @ApiProperty({
    description: 'Number of resume pages sent to OpenRouter',
    example: 3,
  })
  pageCount: number;

  @ApiProperty({ type: ProviderRunDto })
  openrouter: ProviderRunDto;
}

export class TextSummaryDiffDto {
  @ApiProperty({ type: NumericComparisonDto })
  length: NumericComparisonDto;

  @ApiProperty({ type: NumericComparisonDto })
  sentenceCount: NumericComparisonDto;

  @ApiProperty({ example: -4200 })
  latencyDeltaMs: number;

  @ApiProperty({ example: 0.0001 })
  costDelta: number;
}

export class TextSummaryComparisonResultDto {
  @ApiProperty({ type: ProviderRunDto })
  openai: ProviderRunDto;

  @ApiProperty({ type: ProviderRunDto })
  openrouter: ProviderRunDto;

  @ApiProperty({ type: TextSummaryDiffDto })
  diff: TextSummaryDiffDto;
}
