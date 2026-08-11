import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OfferPanelRecipientType } from '@prisma/client';

export class RecipientDto {
  @ApiProperty({ enum: OfferPanelRecipientType })
  @IsEnum(OfferPanelRecipientType)
  recipient_type: OfferPanelRecipientType;

  @ApiPropertyOptional({ description: 'Required when type = client_user' })
  @ValidateIf((o) => o.recipient_type === 'client_user')
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({ description: 'Required when type = company_contact' })
  @ValidateIf((o) => o.recipient_type === 'company_contact')
  @IsUUID()
  company_id?: string;

  @ApiProperty({ example: 'Dr. Jane Smith' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'jane@clinic.com' })
  @IsEmail()
  email: string;
}

export class CreateOfferPanelDto {
  @ApiProperty({ example: 'Top VA candidates for your practice' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Activate the $1,760/mo promo for this panel. Stored as a flag only — the ' +
      'price and copy come from the brand config at render time, and the ' +
      'struck-through original is recomputed live from each candidate’s bill rate. ' +
      'Deliberately absent from UpdateOfferPanelDto: the panel has already been ' +
      'emailed with a price, so flipping the promo post-send would be a ' +
      'bait-and-switch.',
  })
  @IsOptional()
  @IsBoolean()
  promo_enabled?: boolean;

  @ApiProperty({
    example: 'MedVirtual',
    description:
      'Business unit hubspot_value. Must match one of the currently visible ' +
      'business units (validated against BusinessUnitContext at the service ' +
      'layer, since the visible set is data-driven and can grow without a ' +
      'code change).',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim();
    if (normalized === 'BerryVirtual') return 'Berry Virtual';
    return normalized;
  })
  @IsString()
  business_unit: string;

  @ApiProperty({ type: [RecipientDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: RecipientDto[];

  @ApiProperty({ type: [String], minItems: 1, description: 'Candidate IDs' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  candidateIds: string[];
}
