import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CompareTextDto {
  @ApiProperty({
    description: 'Text to summarize with both providers',
    example:
      'We are looking for an experienced virtual medical assistant to support a busy cardiology practice...',
    minLength: 50,
  })
  @IsString()
  @MinLength(50)
  text: string;

  @ApiPropertyOptional({
    description:
      'Optional OpenRouter model cascade to test instead of the configured default',
    example: ['openrouter/free'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  models?: string[];
}
