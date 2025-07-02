// auth/dto/sign-in.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  
  @ApiProperty({ required: true, description: 'User first Name' })
  @IsString()
  firstName: string;

  @ApiProperty({ required: true, description: 'User last Name' })
  @IsString()
  lastname: string;

  @ApiProperty({ required: true, description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ required: true, description: 'User role' })
  @IsString()
  role: string;

  @ApiProperty({ required: true, description: 'User password' })
  @MinLength(6)
  password: string;
}
