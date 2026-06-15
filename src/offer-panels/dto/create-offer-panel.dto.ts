import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OfferPanelRecipientType } from '@prisma/client';

export class RecipientDto {
  @ApiProperty({ enum: OfferPanelRecipientType })
  @IsEnum(OfferPanelRecipientType)
  type: OfferPanelRecipientType;

  @ApiPropertyOptional({ description: 'Required when type = client_user' })
  @ValidateIf((o) => o.type === 'client_user')
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({ description: 'Required when type = company_contact' })
  @ValidateIf((o) => o.type === 'company_contact')
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

  @ApiProperty({ enum: ['MedVirtual', 'Berry Virtual'] })
  @IsIn(['MedVirtual', 'Berry Virtual'])
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
