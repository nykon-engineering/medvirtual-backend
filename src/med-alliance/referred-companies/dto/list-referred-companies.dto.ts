import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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

  // Admin only: filter by the affiliate who submitted the referral
  @IsOptional()
  @IsUUID()
  affiliate_id?: string;

  @IsOptional()
  @IsEnum(['createdAt', 'name'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
