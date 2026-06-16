import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { OfferPanelRecipientType, OfferPanelStatus } from '@prisma/client';

export class QueryOfferPanelsDto {
  @ApiProperty({
    description: 'Search by title, recipient name, or recipient email',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

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

  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
