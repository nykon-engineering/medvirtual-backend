import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ConfirmPanelHireRequestDto {
  @ApiProperty({ description: ' Hire Request ID', type: String })
  @IsString()
  hireRequest_id: string;

  @ApiProperty({ description: 'Candidates IDs', type: [String] })
  @IsArray()
  candidates_id: string[];
}
