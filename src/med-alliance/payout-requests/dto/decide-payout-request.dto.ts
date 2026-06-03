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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DecidePayoutRequestDto {
  @ApiProperty({
    description: 'Approval decision for the payout request',
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  @IsEnum(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  // Admin may override the requested amount on approval.
  @ApiPropertyOptional({
    description:
      'Override the requested amount on approval (defaults to requested amount)',
    example: 1450.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  approved_amount?: number;

  // Required when decision is "rejected".
  @ApiPropertyOptional({
    description: 'Reason for rejection (required when decision is rejected)',
    example: 'Missing banking information',
  })
  @ValidateIf((o) => o.decision === 'rejected')
  @IsString()
  rejection_reason?: string;
}

export class MarkPayoutPaidDto {
  // B2: actual amount disbursed (may differ from approved_amount due to fees)
  @ApiPropertyOptional({
    description:
      'Actual amount disbursed (may differ from approved amount due to fees)',
    example: 1400.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  paid_amount?: number;

  // B2: payment proof notes / description
  @ApiPropertyOptional({
    description: 'Payment proof notes or description',
    maxLength: 5000,
    example: 'Wire transfer confirmed on 2024-03-15',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  payment_proof_notes?: string;
}

export class CancelPayoutRequestDto {
  @ApiPropertyOptional({
    description: 'Reason for cancelling the payout request',
    maxLength: 1000,
    example:
      'Affiliate requested cancellation to resubmit with updated banking info',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class AddPayoutNoteDto {
  @ApiProperty({
    description: 'Note visibility type',
    enum: ['internal', 'user'],
    example: 'internal',
  })
  @IsEnum(['internal', 'user'])
  type: 'internal' | 'user';

  @ApiProperty({
    description: 'Note content',
    minLength: 1,
    maxLength: 2000,
    example: 'Banking details verified with affiliate',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class UpdatePayoutNoteDto {
  @ApiProperty({
    description: 'Updated note content',
    minLength: 1,
    maxLength: 2000,
    example: 'Updated: Banking details verified and confirmed',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
