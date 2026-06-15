import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateOfferPanelDto {
  @ApiProperty({ description: 'New title for the offer panel', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'New description for the offer panel', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
