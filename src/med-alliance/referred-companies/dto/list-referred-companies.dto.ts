import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { MedAllianceReferralStatus, ReferralStage } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListReferredCompaniesDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 100,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;

  // Search by company name or email
  @ApiPropertyOptional({
    description: 'Search by company name or email',
    example: 'Acme',
  })
  @IsOptional()
  @IsString()
  search?: string;

  // Filter by organization status (active | inactive | deleted)
  @ApiPropertyOptional({
    description: 'Filter by organization status',
    enum: ['active', 'inactive', 'deleted'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'deleted'])
  status?: string;

  // Admin only: filter by the affiliate who submitted the referral (legacy param)
  @ApiPropertyOptional({
    description:
      'Admin only: filter by the affiliate who submitted the referral (legacy)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  affiliate_id?: string;

  // Admin pipeline filter: filter by referring affiliate user id (matches referredByAffiliate.id)
  @ApiPropertyOptional({
    description: 'Admin only: filter by referring affiliate user UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  affiliate_user_id?: string;

  // Admin pipeline filter: filter by pipeline stage
  @ApiPropertyOptional({
    description: 'Admin only: filter by referral pipeline stage',
    enum: ReferralStage,
  })
  @IsOptional()
  @IsEnum(ReferralStage)
  referral_stage?: ReferralStage;

  // Admin pipeline filter: filter by eligibility status
  @ApiPropertyOptional({
    description:
      'Admin only: filter by Med Alliance referral eligibility status',
    enum: MedAllianceReferralStatus,
  })
  @IsOptional()
  @IsEnum(MedAllianceReferralStatus)
  med_alliance_referral_status?: MedAllianceReferralStatus;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['createdAt', 'name'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['createdAt', 'name'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
