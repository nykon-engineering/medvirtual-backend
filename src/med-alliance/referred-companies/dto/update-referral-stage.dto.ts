import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReferralStage } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReferralStageDto {
  @ApiProperty({ description: 'New referral pipeline stage to set', enum: ReferralStage })
  @IsEnum(ReferralStage)
  stage: ReferralStage;

  @ApiPropertyOptional({ description: 'Optional reason or notes for the stage change', example: 'Moved to negotiation after initial call' })
  @IsOptional()
  @IsString()
  reason?: string;
}
