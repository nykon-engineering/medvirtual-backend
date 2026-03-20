import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PayoutMethod } from './create-affiliate-profile.dto';

export enum AffiliateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
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
}
