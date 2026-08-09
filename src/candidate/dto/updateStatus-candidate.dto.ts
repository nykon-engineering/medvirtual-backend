import { ApiProperty } from '@nestjs/swagger';
import { dbToStageDictionary } from '../../common/dictionaries/stage-dictionary';
import { IsString } from 'class-validator';

export class updateStatusHubspotDTO {
  @ApiProperty({
    description: 'The origin status of the candidate',
    example: 'applied, endorsed',
    type: String,
    enum: Object.values(dbToStageDictionary),
  })
  @IsString()
  status: string;
}
