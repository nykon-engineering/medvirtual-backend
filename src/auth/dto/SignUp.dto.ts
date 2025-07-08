import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  
  @ApiProperty({ required: true, description: 'User first Name' })
  @IsString()
  firstName: string;

  @ApiProperty({ required: true, description: 'User last Name' })
  @IsString()
  lastName: string;

  @ApiProperty({ required: true, description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ required: false, description: 'User role' })
  role: string;

  @ApiProperty({ required: true, description: 'User password' })
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false, description: 'User Job title' })
  @IsString()
  jobTitle: string;

  @ApiProperty({ required: false, description: 'User company nanme' })
  @IsString()
  companyName: string
}
