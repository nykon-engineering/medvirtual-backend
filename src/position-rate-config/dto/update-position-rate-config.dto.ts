import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePositionRateConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  floor_price_english?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourly_rate_english?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  floor_price_bilingual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourly_rate_bilingual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  margin_per_hour?: number;
}
