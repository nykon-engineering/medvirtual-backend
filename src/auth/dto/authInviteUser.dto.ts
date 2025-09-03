import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional } from 'class-validator';

export class AuthInviteUserDto {
  @ApiProperty({ required: true, description: 'User email' })
  @IsEmail()
  email: string;

  @ApiProperty({ required: false, description: 'User role' })
  @IsString()
  role: string;

  @ApiProperty({ required: false, description: 'User company name' })
  @IsString()
  companyName: string;

  @ApiProperty({ required: true, description: 'Organization ID' })
  @IsString()
  organizationId: string;

  @ApiProperty({ required: false, description: 'User first name' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiProperty({ required: false, description: 'User last name' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({ required: false, description: 'User job title' })
  @IsOptional()
  @IsString()
  job_title?: string;

  @ApiProperty({ required: false, description: 'User phone number' })
  @IsOptional()
  @IsString()
  phone?: string;
}
