import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OrganizationRole, OrganizationStatus } from '@prisma/client';

export class GetOrganizationsDto {
  @ApiProperty({
    required: false,
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    required: false,
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    required: false,
    description:
      'Search term to filter organizations by name, email, description, or member user name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by organization role',
    enum: OrganizationRole,
  })
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  @ApiProperty({
    required: false,
    description: 'Filter by organization type',
    enum: OrganizationRole,
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by organization status',
    enum: OrganizationStatus,
  })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @ApiProperty({
    required: false,
    description: 'Filter by industry',
  })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by location',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    required: false,
    description:
      'Filter by admin ID (available for system_super_admin and system_admin)',
  })
  @IsOptional()
  @IsString()
  admin?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by Business Unit',
  })
  @IsOptional()
  @IsString()
  business_unit?: string;

  @ApiProperty({
    required: false,
    description:
      'Filter if has user (true = only organizations with userCount > 0)',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  hasUser?: boolean;

  @ApiProperty({
    required: false,
    description:
      'Filter if has staff (true = only organizations with staffCount > 0)',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  hasStaff?: boolean;

  @ApiProperty({
    required: false,
    description: 'Filter by Hubstaff connection status',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsEnum(['true', 'false'])
  hubstaffConnected?: 'true' | 'false';

  @ApiProperty({
    required: false,
    description: 'Filter by billing mode',
    enum: ['arrears', 'prebill'],
  })
  @IsOptional()
  @IsEnum(['arrears', 'prebill'])
  billing_mode?: 'arrears' | 'prebill';

  @ApiProperty({
    required: false,
    description: 'Sort field',
    enum: [
      'name',
      'email',
      'createdAt',
      'updatedAt',
      'number_of_employees',
      'userCount',
      'activeStaffCount',
    ],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({
    required: false,
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiProperty({
    required: false,
    description:
      'When true, only return organizations that have no referral (referred_by_affiliate_id is null)',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  without_referral?: boolean;
}
