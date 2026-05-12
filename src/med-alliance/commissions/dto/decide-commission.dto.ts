import { IsEnum, IsNumberString, IsString, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DecideCommissionDto {
  @ApiProperty({ description: 'Decision on the commission', enum: ['eligible', 'rejected'], example: 'eligible' })
  @IsEnum(['eligible', 'rejected'])
  decision: 'eligible' | 'rejected';

  // Required when decision is "rejected" — reason must be provided.
  @ApiPropertyOptional({ description: 'Reason for rejection (required when decision is rejected)', example: 'Invoice amount does not meet minimum threshold' })
  @ValidateIf((o) => o.decision === 'rejected')
  @IsString()
  reason?: string;
}

export class VoidCommissionDto {
  // Reason is always required when voiding a commission.
  @ApiProperty({ description: 'Reason for voiding the commission', example: 'Duplicate commission detected for the same invoice' })
  @IsString()
  reason: string;
}

export class ReinstateCommissionDto {
  @ApiProperty({ description: 'Reason for reinstating the commission', example: 'Review confirmed the commission is valid' })
  @IsString()
  reason: string;
}

export class UnvoidCommissionDto {
  @ApiProperty({ description: 'Reason for unvoiding the commission', example: 'Original void was made in error' })
  @IsString()
  reason: string;
}

export class UpdateBaseAmountDto {
  @ApiProperty({ description: 'New base invoice amount as a numeric string', example: '1500.00' })
  @IsNumberString()
  base_amount: string;
}
