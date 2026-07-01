import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class BillComMfaValidateDto {
  @ApiProperty({
    required: true,
    description: 'Challenge ID returned by the MFA challenge request',
  })
  @IsString()
  challengeId: string;

  @ApiProperty({
    required: true,
    description: 'The 6-digit code sent to the admin’s registered device',
  })
  @IsString()
  @Length(6, 6)
  token: string;
}
