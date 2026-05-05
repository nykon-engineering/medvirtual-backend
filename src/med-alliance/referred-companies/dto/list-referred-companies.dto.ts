import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { MedAllianceReferralStatus, ReferralStage } from '@prisma/client';

export class ListReferredCompaniesDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;

  // Search by company name or email
  @IsOptional()
  @IsString()
  search?: string;

  // Filter by organization status (active | inactive | deleted)
  @IsOptional()
  @IsEnum(['active', 'inactive', 'deleted'])
  status?: string;

  // Admin only: filter by the affiliate who submitted the referral (legacy param)
  @IsOptional()
  @IsUUID()
  affiliate_id?: string;

  // Admin pipeline filter: filter by referring affiliate user id (matches referredByAffiliate.id)
  @IsOptional()
  @IsUUID()
  affiliate_user_id?: string;

  // Admin pipeline filter: filter by pipeline stage
  @IsOptional()
  @IsEnum(ReferralStage)
  referral_stage?: ReferralStage;

  // Admin pipeline filter: filter by eligibility status
  @IsOptional()
  @IsEnum(MedAllianceReferralStatus)
  med_alliance_referral_status?: MedAllianceReferralStatus;

  @IsOptional()
  @IsEnum(['createdAt', 'name'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
