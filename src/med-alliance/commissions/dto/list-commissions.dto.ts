import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum CommissionStatus {
  DETECTED = 'detected',
  PENDING_ADMIN_CONFIRMATION = 'pending_admin_confirmation',
  ELIGIBLE = 'eligible',
  REQUESTED = 'requested',
  PAID = 'paid',
  VOID = 'void',
  REJECTED = 'rejected',
}

export class ListCommissionsDto {
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

  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  // Admin only: filter commissions by organization
  @IsOptional()
  @IsUUID()
  organization_id?: string;

  // Admin only: filter commissions by affiliate user id
  @IsOptional()
  @IsUUID()
  affiliate_id?: string;

  @IsOptional()
  @IsDateString()
  created_from?: string;

  @IsOptional()
  @IsDateString()
  created_to?: string;

  @IsOptional()
  @IsEnum(['createdAt', 'commission_amount', 'admin_decision_at'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
