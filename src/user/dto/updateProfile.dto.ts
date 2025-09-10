import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUrl,
  IsDateString,
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
  @ApiProperty({ required: false, description: 'Organization name' })
  organization_name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Organization description',
  })
  organization_description?: string;

  @IsOptional()
  @IsUrl()
  @ApiProperty({ required: false, description: 'Organization website URL' })
  organization_website_url?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'Organization industry' })
  organization_industry?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000000)
  @ApiProperty({ required: false, description: 'Number of employees' })
  organization_number_of_employees?: number;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Organization location (country)',
  })
  organization_location?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false, description: 'Organization date founded' })
  organization_date_founded?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Organization specialties (comma-separated)',
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
  @IsUrl()
  @ApiProperty({
    required: false,
    description: 'Signed document URL (system admin only)',
  })
  signed_document_url?: string;
}
