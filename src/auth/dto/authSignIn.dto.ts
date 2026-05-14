import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class AuthSignInDto {
  @ApiProperty({ required: true, description: 'User email' })
  @IsEmail()
  email: string;

  @ApiProperty({ required: true, description: 'User password' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false, description: 'Remember me option' })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
