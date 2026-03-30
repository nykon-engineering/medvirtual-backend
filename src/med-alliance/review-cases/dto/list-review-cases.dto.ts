import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListReviewCasesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsIn(['open', 'resolved'])
  status?: 'open' | 'resolved';

  @IsOptional()
  @IsIn(['multiple_hubspot_matches', 'reconciliation_invoice_changed', 'soft_duplicate_referral'])
  reason_code?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
