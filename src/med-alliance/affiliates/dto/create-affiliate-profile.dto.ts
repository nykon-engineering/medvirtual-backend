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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PayoutMethod {
  ACH = 'ach',
  WIRE = 'wire',
  PAYPAL = 'paypal',
  ZELLE = 'zelle',
  OTHER = 'other',
}

export class CreateAffiliateProfileDto {
  @ApiProperty({ description: 'UUID of the existing platform user to create an affiliate profile for', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @ApiPropertyOptional({ description: 'HubSpot contact ID associated with this affiliate', example: '12345678' })
  @IsOptional()
  @IsString()
  hubspot_id?: string;

  // Commission percentage (e.g. 10.00 = 10%). Applied as snapshot at detection time.
  @ApiProperty({ description: 'Default commission percentage (0-100) applied at detection time', example: 10.00, minimum: 0, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commission_percent_default: number;

  @ApiPropertyOptional({ description: 'Preferred payout method', enum: PayoutMethod, example: PayoutMethod.ACH })
  @IsOptional()
  @IsEnum(PayoutMethod)
  payout_preference_method?: PayoutMethod;

  @ApiPropertyOptional({ description: 'Reference number or account identifier for the chosen payout method', example: 'account@bank.com' })
  @IsOptional()
  @IsString()
  payout_preference_reference?: string;

  @ApiPropertyOptional({ description: 'Additional notes about payout preferences', example: 'Preferred transfer on the 1st of each month' })
  @IsOptional()
  @IsString()
  payout_preference_notes?: string;

  @ApiPropertyOptional({ description: 'Structured payout banking details as a JSON object' })
  @IsOptional()
  @IsObject()
  payout_details?: Prisma.InputJsonValue;
}
