// auth/dto/sign-in.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignInDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
