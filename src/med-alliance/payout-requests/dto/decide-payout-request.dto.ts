import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  MinLength,
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
  // B2: transaction reference (was payment_reference — kept for backward compat)
  @IsOptional()
  @IsString()
  transaction_reference?: string;

  /** @deprecated Use transaction_reference instead */
  @IsOptional()
  @IsString()
  payment_reference?: string;

  // B2: actual amount disbursed (may differ from approved_amount due to fees)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  paid_amount?: number;

  // B2: payment proof notes / description
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  payment_proof_notes?: string;

  // If omitted, defaults to current timestamp.
  @IsOptional()
  @IsDateString()
  paid_at?: string;
}

export class AddPayoutNoteDto {
  @IsEnum(['internal', 'user'])
  type: 'internal' | 'user';

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
