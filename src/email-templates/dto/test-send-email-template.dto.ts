import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TestSendEmailTemplateDto {
  @ApiPropertyOptional({ description: 'Business unit slug to resolve branding' })
  @IsOptional()
  @IsString()
  business_unit?: string;
}
