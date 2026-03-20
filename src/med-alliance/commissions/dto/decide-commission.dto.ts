import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';

export class DecideCommissionDto {
  @IsEnum(['eligible', 'rejected'])
  decision: 'eligible' | 'rejected';

  // Required when decision is "rejected" — reason must be provided.
  @ValidateIf((o) => o.decision === 'rejected')
  @IsString()
  reason?: string;
}

export class VoidCommissionDto {
  // Reason is always required when voiding a commission.
  @IsString()
  reason: string;
}
