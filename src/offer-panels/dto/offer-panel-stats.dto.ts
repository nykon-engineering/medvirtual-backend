import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class OfferPanelStatsQueryDto {
  @ApiProperty({
    description:
      'Start of the window, inclusive (YYYY-MM-DD). Filters on the panel creation date.',
    required: false,
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description:
      'End of the window, inclusive (YYYY-MM-DD). Filters on the panel creation date.',
    required: false,
    example: '2026-08-12',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description:
      'Filter by business unit. Accepts the HubSpot value, name, or slug — ' +
      'resolved server-side against the BusinessUnit records.',
    required: false,
  })
  @IsOptional()
  @IsString()
  business_unit?: string;
}
