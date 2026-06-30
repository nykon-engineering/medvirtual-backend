import { IsHexColor, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBrandingDto {
  @ApiPropertyOptional({ description: 'Primary brand color (hex)', example: '#01546B' })
  @IsOptional()
  @IsHexColor()
  primary_color?: string;

  @ApiPropertyOptional({ description: 'Secondary color for hover states (hex)', example: '#013A4F' })
  @IsOptional()
  @IsHexColor()
  secondary_color?: string;

  @ApiPropertyOptional({ description: 'Logo image URL' })
  @IsOptional()
  @IsUrl()
  logo_url?: string;

  @ApiPropertyOptional({ description: 'Display name used in emails' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  company_name?: string;

  @ApiPropertyOptional({ description: 'Layout preset name', example: 'default' })
  @IsOptional()
  @IsString()
  layout_preset?: string;
}
