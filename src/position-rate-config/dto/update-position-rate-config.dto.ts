import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePositionRateConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  medVirtual_floor_price_english?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  berryVirtual_floor_price_english?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medVirtual_floor_price_bilingual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  berryVirtual_floor_price_bilingual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medVirtual_margin_per_hour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  berryVirtual_margin_per_hour?: number;
}
