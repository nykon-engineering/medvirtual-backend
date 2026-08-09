import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayoutMethod } from '../../affiliates/dto/create-affiliate-profile.dto';

export class CreatePayoutRequestDto {
  // IDs of AffiliateCommission records with status "eligible" to include.
  @ApiProperty({
    description:
      'Array of eligible commission UUIDs to include in this payout request',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  commission_ids: string[];

  // If omitted, the affiliate's current payout_preference_method is used.
  @ApiPropertyOptional({
    description:
      "Payment method override (defaults to affiliate's saved preference)",
    enum: PayoutMethod,
  })
  @IsOptional()
  @IsEnum(PayoutMethod)
  payment_method?: PayoutMethod;
}

// Admin-initiated payout request on behalf of an affiliate.
export class AdminCreatePayoutRequestDto {
  @ApiProperty({
    description:
      'UUID of the affiliate profile on whose behalf this payout request is created',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  affiliate_profile_id: string;

  @ApiProperty({
    description:
      'Array of eligible commission UUIDs to include in this payout request',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  commission_ids: string[];
}
