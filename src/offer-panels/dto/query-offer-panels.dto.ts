import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OfferPanelRecipientType, OfferPanelStatus } from '@prisma/client';

/** Parses a query-string number without turning an absent value into NaN. */
const toOptionalInt = ({ value }: { value: unknown }): unknown =>
  value === undefined || value === null || value === ''
    ? undefined
    : parseInt(String(value), 10);

export class QueryOfferPanelsDto {
  @ApiProperty({
    description: 'Search by title, recipient name, or recipient email',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by the user who created the offer panel',
    required: false,
  })
  @IsOptional()
  @IsString()
  created_by?: string;

  @ApiProperty({
    description: 'Filter by panel status',
    enum: OfferPanelStatus,
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: OfferPanelStatus;

  @ApiProperty({
    description: 'Filter by recipient type',
    enum: OfferPanelRecipientType,
    required: false,
  })
  @IsOptional()
  @IsString()
  recipient_type?: OfferPanelRecipientType;

  @ApiProperty({
    description: 'Filter by recipient org name (partial match)',
    required: false,
  })
  @IsOptional()
  @IsString()
  client?: string;

  @ApiProperty({
    description:
      'Filter by business unit. Accepts the HubSpot value, name, or slug — ' +
      'resolved server-side against the BusinessUnit records.',
    required: false,
  })
  @IsOptional()
  @IsString()
  business_unit?: string;

  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page (max 100)',
    required: false,
    default: 20,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  // Capped so a caller can never request the whole table in one page again.
  @Max(100)
  limit?: number = 20;
}
