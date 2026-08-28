import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePositionRateConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  medical_floor_price_english?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  non_medical_floor_price_english?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medical_floor_price_bilingual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  non_medical_floor_price_bilingual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medical_margin_per_hour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  non_medical_margin_per_hour?: number;
}
