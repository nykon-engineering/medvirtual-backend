import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListInvoicesDto {
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

  // Filter by raw HubSpot invoice_status (e.g. "paid", "outstanding")
  @IsOptional()
  @IsString()
  invoice_status?: string;

  // Filter by payment_status when available in the HubSpot contract
  @IsOptional()
  @IsString()
  payment_status?: string;

  // When true, return only snapshots where is_candidate_input === true
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  candidates_only?: boolean;

  @IsOptional()
  @IsDateString()
  paid_at_from?: string;

  @IsOptional()
  @IsDateString()
  paid_at_to?: string;

  // Default: paid_at DESC for idempotency consistency (MA-003 spec).
  @IsOptional()
  @IsEnum(['paid_at', 'invoice_amount', 'createdAt'])
  sortBy?: string = 'paid_at';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
