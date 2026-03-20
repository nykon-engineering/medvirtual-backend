import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class DecidePayoutRequestDto {
  @IsEnum(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  // Admin may override the requested amount on approval.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  approved_amount?: number;

  // Required when decision is "rejected".
  @ValidateIf((o) => o.decision === 'rejected')
  @IsString()
  rejection_reason?: string;
}

export class MarkPayoutPaidDto {
  @IsOptional()
  @IsString()
  payment_reference?: string;

  // If omitted, defaults to current timestamp.
  @IsOptional()
  @IsDateString()
  paid_at?: string;
}
