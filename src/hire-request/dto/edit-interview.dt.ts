import { DateTime } from '@hubspot/api-client/lib/codegen/crm/associations/v4';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class editInterviewDTO {
  @ApiProperty({
    description: 'The date of the interview',
    type: String,
    required: true,
  })
  @IsString()
  date_time: DateTime;

  @ApiProperty({
    description: 'Just date of the interview',
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  date: string;

  @ApiProperty({
    description: 'Just time of the interview',
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  time: string;

  @ApiProperty({
    description: 'The link of the interview',
    example: 'https://meet.google.com/XXXX',
    required: false,
  })
  @IsString()
  @IsOptional()
  interview_link: string;
}
