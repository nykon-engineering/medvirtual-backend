import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class BillComPhoneSetupDto {
  @ApiProperty({
    required: true,
    description: 'Phone number in E.164 format (e.g. +14155552671)',
    example: '+14155552671',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'Phone number must be in E.164 format, e.g. +14155552671',
  })
  phone: string;
}
