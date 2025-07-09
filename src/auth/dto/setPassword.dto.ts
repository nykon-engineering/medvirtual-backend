import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
  
  @ApiProperty({ required: true, description: 'Invitation token' })
  @IsString()
  token: string;

  @ApiProperty({ required: true, description: 'password provided by user' })
  @IsString()
  password: string;

}
