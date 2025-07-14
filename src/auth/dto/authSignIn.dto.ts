import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AuthSignInDto {
  @ApiProperty({ required: true, description: 'User email' })
  @IsEmail()
  email: string;
  
  @ApiProperty({ required: true, description: 'User password' })
  @IsString()
  @MinLength(6)
  password: string;
}
