import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CompareResumeDto {
  @ApiProperty({
    description:
      'ID of the candidate whose resume will be parsed by both providers',
    example: 'b3f1c2d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
  })
  @IsString()
  @IsNotEmpty()
  candidateId: string;

  @ApiPropertyOptional({
    description:
      'Optional OpenRouter model cascade to test instead of the configured default',
    example: ['google/gemma-4-26b-a4b-it:free', 'openrouter/free'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  models?: string[];

  @ApiPropertyOptional({
    description:
      'Limit how many resume pages are sent, to cap token usage on long resumes',
    example: 3,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPages?: number;
}
