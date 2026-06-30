import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PreviewEmailTemplateDto {
  @ApiPropertyOptional({
    description: 'Override subject for preview (uses saved subject if omitted)',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Override body for preview' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'Business unit slug to resolve branding' })
  @IsOptional()
  @IsString()
  business_unit?: string;
}
