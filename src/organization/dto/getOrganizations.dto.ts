import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
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
      'Search term to filter organizations by name, email, or description',
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
      'Filter by concierge ID (only available for system_super_admin)',
  })
  @IsOptional()
  @IsString()
  concierge?: string;

  @ApiProperty({
    required: false,
    description: 'Sort field',
    enum: ['name', 'email', 'createdAt', 'updatedAt', 'number_of_employees'],
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
}
