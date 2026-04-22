import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PayoutMethod } from './create-affiliate-profile.dto';
import { Prisma } from '@prisma/client';

export enum AffiliateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  INVITED = 'invited',
}

// Used by admin — all fields optional, including status and commission rate.
export class UpdateAffiliateProfileDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commission_percent_default?: number;

  @IsOptional()
  @IsEnum(AffiliateStatus)
  status?: AffiliateStatus;

  @IsOptional()
  @IsEnum(PayoutMethod)
  payout_preference_method?: PayoutMethod;

  @IsOptional()
  @IsString()
  payout_preference_reference?: string;

  @IsOptional()
  @IsString()
  payout_preference_notes?: string;

  @IsOptional()
  @IsObject()
  payout_details?: Prisma.InputJsonValue;
}

// Used by admin to link a user to an existing organization.
export class LinkOrganizationDto {
  @IsString()
  organization_id: string;
}

// Used by affiliate self-enrollment — optional payout details at join time.
export class JoinProgramDto {
  @IsOptional()
  @IsObject()
  payout_details?: Prisma.InputJsonValue;
}

// Used by affiliate (/me route) — only payout preferences allowed.
export class UpdateAffiliatePayoutPreferencesDto {
  @IsOptional()
  @IsEnum(PayoutMethod)
  payout_preference_method?: PayoutMethod;

  @IsOptional()
  @IsString()
  payout_preference_reference?: string;

  @IsOptional()
  @IsString()
  payout_preference_notes?: string;

  @IsOptional()
  @IsObject()
  payout_details?: Prisma.InputJsonValue;
}
