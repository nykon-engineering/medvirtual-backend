import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayoutMethod } from './create-affiliate-profile.dto';
import { Prisma } from '@prisma/client';

export enum AffiliateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  INVITED = 'invited',
  PENDING = 'pending',
}

// Used by admin — all fields optional, including status and commission rate.
export class UpdateAffiliateProfileDto {
  @ApiPropertyOptional({
    description: 'Default commission percentage (0-100)',
    example: 10.0,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commission_percent_default?: number;

  @ApiPropertyOptional({
    description: 'Affiliate account status',
    enum: AffiliateStatus,
  })
  @IsOptional()
  @IsEnum(AffiliateStatus)
  status?: AffiliateStatus;

  @ApiPropertyOptional({
    description: 'Preferred payout method',
    enum: PayoutMethod,
  })
  @IsOptional()
  @IsEnum(PayoutMethod)
  payout_preference_method?: PayoutMethod;

  @ApiPropertyOptional({
    description:
      'Reference number or account identifier for the chosen payout method',
    example: 'account@bank.com',
  })
  @IsOptional()
  @IsString()
  payout_preference_reference?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about payout preferences',
  })
  @IsOptional()
  @IsString()
  payout_preference_notes?: string;

  @ApiPropertyOptional({
    description: 'Structured payout banking details as a JSON object',
  })
  @IsOptional()
  @IsObject()
  payout_details?: Prisma.InputJsonValue;
}

// Used by admin to link a user to an existing organization.
export class LinkOrganizationDto {
  @ApiProperty({
    description: 'UUID of the organization to link to this affiliate user',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  organization_id: string;
}

// Used by affiliate self-enrollment — optional payout details at join time.
export class JoinProgramDto {
  @ApiPropertyOptional({
    description:
      'Structured payout banking details provided at enrollment time',
  })
  @IsOptional()
  @IsObject()
  payout_details?: Prisma.InputJsonValue;
}

// Used by affiliate (/me route) — only payout preferences allowed.
export class UpdateAffiliatePayoutPreferencesDto {
  @ApiPropertyOptional({
    description: 'Preferred payout method',
    enum: PayoutMethod,
  })
  @IsOptional()
  @IsEnum(PayoutMethod)
  payout_preference_method?: PayoutMethod;

  @ApiPropertyOptional({
    description:
      'Reference number or account identifier for the chosen payout method',
    example: 'account@bank.com',
  })
  @IsOptional()
  @IsString()
  payout_preference_reference?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about payout preferences',
  })
  @IsOptional()
  @IsString()
  payout_preference_notes?: string;

  @ApiPropertyOptional({
    description: 'Structured payout banking details as a JSON object',
  })
  @IsOptional()
  @IsObject()
  payout_details?: Prisma.InputJsonValue;
}
