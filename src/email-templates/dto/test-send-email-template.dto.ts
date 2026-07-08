import { IsHexColor, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TestSendEmailTemplateDto {
  @ApiPropertyOptional({
    description: 'Business unit slug to resolve branding',
  })
  @IsOptional()
  @IsString()
  business_unit?: string;

  @ApiPropertyOptional({
    description:
      'Unsaved primary brand color override (hex). Falls back to saved branding when omitted.',
    example: '#01546B',
  })
  @IsOptional()
  @IsHexColor()
  primary_color?: string;

  @ApiPropertyOptional({
    description:
      'Unsaved secondary/hover color override (hex). Falls back to saved branding when omitted.',
    example: '#013A4F',
  })
  @IsOptional()
  @IsHexColor()
  secondary_color?: string;

  @ApiPropertyOptional({
    description:
      'Unsaved logo URL override. Falls back to saved branding when omitted.',
  })
  @IsOptional()
  @IsUrl()
  logo_url?: string;

  @ApiPropertyOptional({
    description:
      'Unsaved company/display name override. Falls back to saved branding when omitted.',
  })
  @IsOptional()
  @IsString()
  company_name?: string;

  @ApiPropertyOptional({
    description:
      'Unsaved layout preset override (default | minimal | hero). Falls back to saved branding when omitted.',
    example: 'default',
  })
  @IsOptional()
  @IsString()
  layout_preset?: string;

  @ApiPropertyOptional({
    description:
      'Unsaved button color override (hex). Falls back to saved branding when omitted.',
    example: '#01546B',
  })
  @IsOptional()
  @IsHexColor()
  button_color?: string;

  @ApiPropertyOptional({
    description:
      'Unsaved button text color override (hex). Falls back to saved branding when omitted.',
    example: '#FFFFFF',
  })
  @IsOptional()
  @IsHexColor()
  button_text_color?: string;
}
