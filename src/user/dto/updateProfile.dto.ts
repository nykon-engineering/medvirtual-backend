import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class UpdateProfileDto {
  // User Fields (Personal Information)
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User first name' })
  first_name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User last name' })
  last_name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User phone number' })
  phone?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User avatar URL' })
  avatar?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User job title' })
  job_title?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User role' })
  role?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, description: 'User verification status' })
  verified?: boolean;

  // Organization Fields (Organization Information)
  // Only available for Organization Admins and Organization Owners
  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Organization name (send empty string to clear)',
  })
  organization_name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Organization description (send empty string to clear)',
  })
  organization_description?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Organization website URL (send empty string to clear)',
  })
  organization_website_url?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Organization industry (send empty string to clear)',
  })
  organization_industry?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  @ApiProperty({
    required: false,
    description: 'Number of employees (send 0 to clear)',
  })
  organization_number_of_employees?: number;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Organization location (send empty string to clear)',
  })
  organization_location?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Organization date founded (send empty string to clear)',
  })
  organization_date_founded?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description:
      'Organization specialties (comma-separated, send empty string to clear)',
  })
  organization_specialties?: string;

  // System Admin Fields (for system_super_admin and system_admin)
  @IsOptional()
  @IsEnum(OrganizationRole)
  @ApiProperty({
    required: false,
    description: 'Organization role (system admin only)',
    enum: OrganizationRole,
  })
  organization_role?: OrganizationRole;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description:
      'Signed document URL (system admin only, send empty string to clear)',
  })
  signed_document_url?: string;
}
