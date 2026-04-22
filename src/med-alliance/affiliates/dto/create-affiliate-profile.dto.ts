import { Prisma } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum PayoutMethod {
  ACH = 'ach',
  WIRE = 'wire',
  PAYPAL = 'paypal',
  ZELLE = 'zelle',
  OTHER = 'other',
}

export class CreateAffiliateProfileDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsOptional()
  @IsString()
  hubspot_id?: string;

  // Commission percentage (e.g. 10.00 = 10%). Applied as snapshot at detection time.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commission_percent_default: number;

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
