import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';

export class panelReadyDTO {
  @ApiProperty({ description: ' Hire Request ID', type: String })
  @IsString()
  hireRequest_id: string;

  @ApiProperty({
    description: 'true if the client can see the panel',
    required: true,
    type: Boolean,
  })
  @IsBoolean()
  readable: boolean;
}
