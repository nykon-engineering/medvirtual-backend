import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBusinessUnitDto {
  @ApiPropertyOptional({ description: 'New display name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ description: 'Activate or deactivate this BU' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
