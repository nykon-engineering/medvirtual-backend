import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AffiliateStatus } from './update-affiliate-profile.dto';

export class ListAffiliatesDto {
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
  limit?: number = 20;

  // Search by affiliate user first_name, last_name or email
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(AffiliateStatus)
  status?: AffiliateStatus;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsEnum(['complete', 'incomplete'])
  banking?: 'complete' | 'incomplete';

  @IsOptional()
  @IsEnum(['with_org', 'without_org'])
  organization?: 'with_org' | 'without_org';
}
