import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AffiliateStatus } from './update-affiliate-profile.dto';

export class ListAffiliatesDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Search by affiliate user first_name, last_name or email
  @ApiPropertyOptional({
    description: 'Search by affiliate name or email',
    example: 'Jane',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by affiliate status',
    enum: AffiliateStatus,
  })
  @IsOptional()
  @IsEnum(AffiliateStatus)
  status?: AffiliateStatus;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Filter by banking details completeness',
    enum: ['complete', 'incomplete'],
  })
  @IsOptional()
  @IsEnum(['complete', 'incomplete'])
  banking?: 'complete' | 'incomplete';

  @ApiPropertyOptional({
    description: 'Filter by organization link status',
    enum: ['with_org', 'without_org'],
  })
  @IsOptional()
  @IsEnum(['with_org', 'without_org'])
  organization?: 'with_org' | 'without_org';
}
