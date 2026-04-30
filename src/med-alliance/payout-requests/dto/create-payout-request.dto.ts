import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { PayoutMethod } from '../../affiliates/dto/create-affiliate-profile.dto';

export class CreatePayoutRequestDto {
  // IDs of AffiliateCommission records with status "eligible" to include.
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  commission_ids: string[];

  // If omitted, the affiliate's current payout_preference_method is used.
  @IsOptional()
  @IsEnum(PayoutMethod)
  payment_method?: PayoutMethod;
}

// Admin-initiated payout request on behalf of an affiliate.
export class AdminCreatePayoutRequestDto {
  @IsUUID()
  affiliate_profile_id: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  commission_ids: string[];
}
