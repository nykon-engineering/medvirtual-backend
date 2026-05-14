import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class returnGetPanelDto {
  @ApiProperty({ description: 'ID of the hire request', type: String })
  @IsString()
  hireRequestId: string;

  @ApiProperty({ description: 'ID of the panel', type: String })
  @IsString()
  panelId: string;

  @ApiProperty({ description: 'Array with candidates', type: String })
  panelCandidates: [];
}
