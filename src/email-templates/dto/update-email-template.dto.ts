import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmailTemplateDto {
  @ApiProperty({ description: 'Email subject line' })
  @IsString()
  @MinLength(1)
  subject: string;

  @ApiPropertyOptional({ description: 'Headline shown at top of email body' })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiProperty({
    description: 'Main body text (supports {{placeholder}} syntax)',
  })
  @IsString()
  @MinLength(1)
  body: string;

  @ApiPropertyOptional({ description: 'CTA button label' })
  @IsOptional()
  @IsString()
  button_label?: string;

  @ApiPropertyOptional({
    description: 'CTA button URL (use {{placeholder}} for dynamic links)',
  })
  @IsOptional()
  @IsString()
  button_url?: string;

  @ApiPropertyOptional({
    description:
      'Platform module this template belongs to (e.g. "talent", "alliance", "administration"). Omit to keep the current value, or send null to clear it.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({
    description:
      'Free-form functionality label used for admin filtering (e.g. "Commission review"). Omit to keep the current value, or send null to clear it.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  functionality?: string | null;

  @ApiPropertyOptional({
    description: 'Reason for this change (for audit history)',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
