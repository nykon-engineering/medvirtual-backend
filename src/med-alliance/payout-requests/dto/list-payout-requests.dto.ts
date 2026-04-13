import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum PayoutRequestStatus {
  REQUESTED = 'requested',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid',
}

export class ListPayoutRequestsDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(PayoutRequestStatus)
  status?: PayoutRequestStatus;

  // Admin only: filter by affiliate user id
  @IsOptional()
  @IsUUID()
  affiliate_id?: string;

  // B6: full-text search on affiliate name / email
  @IsOptional()
  @IsString()
  search?: string;

  // B6: risk flag filter
  @IsOptional()
  @IsEnum(['duplicate', 'missing_banking', 'aging'])
  risk_flag?: 'duplicate' | 'missing_banking' | 'aging';

  // B6: requested_amount range
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount_min?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount_max?: number;

  @IsOptional()
  @IsDateString()
  created_from?: string;

  @IsOptional()
  @IsDateString()
  created_to?: string;

  @IsOptional()
  @IsEnum(['createdAt', 'requested_amount', 'paid_at'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
