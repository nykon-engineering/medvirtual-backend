import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReferralStage } from '@prisma/client';

export class UpdateReferralStageDto {
  @IsEnum(ReferralStage)
  stage: ReferralStage;

  @IsOptional()
  @IsString()
  reason?: string;
}
