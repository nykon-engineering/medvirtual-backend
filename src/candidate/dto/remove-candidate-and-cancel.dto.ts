import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RemoveCandidateAndCancelDto {
  @ApiProperty({ description: 'Hire Request Id', required: true })
  @IsString()
  hireRequestId: string;

  @ApiProperty({ description: 'Candidate Id', required: true })
  @IsString()
  candidateId: string;

  @ApiProperty({ description: 'Reason for cancellation', required: true })
  @IsString()
  reason: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  staffing_coordinator?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  pairing_session_conducted?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  pairing_session_outcome_reason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  count_of_candidates_invited_?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  count_of_candidates_attended_?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  count_of_candidates_interviewed_?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  client_signed_contract_closing_ticket?: string;
}
