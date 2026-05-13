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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PayoutMethod } from '../../affiliates/dto/create-affiliate-profile.dto';

export enum PayoutRequestStatus {
  REQUESTED = 'requested',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export class ListPayoutRequestsDto {
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
    maximum: 200,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by payout request status',
    enum: PayoutRequestStatus,
  })
  @IsOptional()
  @IsEnum(PayoutRequestStatus)
  status?: PayoutRequestStatus;

  // Admin only: filter by affiliate user id
  @ApiPropertyOptional({
    description: 'Admin only: filter by affiliate profile UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  affiliate_id?: string;

  // B6: full-text search on affiliate name / email
  @ApiPropertyOptional({
    description: 'Search by affiliate name or email',
    example: 'Jane',
  })
  @IsOptional()
  @IsString()
  search?: string;

  // B6: risk flag filter
  @ApiPropertyOptional({
    description: 'Filter by risk flag type',
    enum: ['duplicate', 'missing_banking', 'aging'],
  })
  @IsOptional()
  @IsEnum(['duplicate', 'missing_banking', 'aging'])
  risk_flag?: 'duplicate' | 'missing_banking' | 'aging';

  @ApiPropertyOptional({
    description: 'Filter by payment method',
    enum: PayoutMethod,
  })
  @IsOptional()
  @IsEnum(PayoutMethod)
  payment_method?: PayoutMethod;

  // B6: requested_amount range
  @ApiPropertyOptional({
    description: 'Minimum requested amount filter',
    example: 100.0,
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount_min?: number;

  @ApiPropertyOptional({
    description: 'Maximum requested amount filter',
    example: 5000.0,
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount_max?: number;

  @ApiPropertyOptional({
    description: 'Filter requests created from this date (ISO date string)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  created_from?: string;

  @ApiPropertyOptional({
    description: 'Filter requests created up to this date (ISO date string)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  created_to?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['createdAt', 'requested_amount', 'paid_at'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['createdAt', 'requested_amount', 'paid_at'])
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
