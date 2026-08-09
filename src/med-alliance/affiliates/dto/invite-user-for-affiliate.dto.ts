import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteUserForAffiliateDto {
  @ApiProperty({
    description: 'First name of the user to invite',
    example: 'Jane',
  })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({
    description: 'Last name of the user to invite',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({
    description: 'Email address for the invitation',
    example: 'jane.doe@hospital.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: 'Phone number of the user',
    example: '+1 555 123 4567',
  })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Job title of the user',
    example: 'Director of Operations',
  })
  @IsOptional()
  @IsString()
  job_title?: string;

  @ApiPropertyOptional({
    description: 'Company or organization name',
    example: 'Sunshine Healthcare Group',
  })
  @IsOptional()
  @IsString()
  company_name?: string;
}
