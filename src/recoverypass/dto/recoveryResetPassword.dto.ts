import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsStrongPassword } from 'class-validator';

export class RecoveryResetPasswordDto {
  @ApiProperty({ required: true, description: 'The authentication code hash' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ required: true, description: 'The new password to set' })
  @IsStrongPassword()
  @IsNotEmpty()
  password: string;
}
