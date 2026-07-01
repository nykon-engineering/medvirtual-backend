import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class BillComPhoneValidateDto {
  @ApiProperty({
    required: true,
    description: 'Setup ID returned by the phone MFA setup request',
  })
  @IsString()
  setupId: string;

  @ApiProperty({
    required: true,
    description: 'The code sent to the phone number being validated',
  })
  @IsString()
  token: string;
}
