import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword } from 'class-validator';

export class AuthUpdatePasswordDto {
  @ApiProperty({ required: true, description: 'Old password provided by user' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ required: true, description: 'New password provided by user' })
  @IsString()
  password: string;
}
