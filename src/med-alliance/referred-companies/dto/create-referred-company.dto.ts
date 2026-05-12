import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReferredCompanyDto {
  @ApiProperty({ description: 'Company name', example: 'Acme Healthcare' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Company email address', example: 'contact@acme.com' })
  @IsEmail()
  @IsOptional()
  email: string;

  @ApiPropertyOptional({ description: 'Company website URL', example: 'https://acme.com' })
  @IsString()
  @IsOptional()
  website_url: string;

  @ApiProperty({ description: 'Primary contact first name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  contact_first_name: string;

  @ApiProperty({ description: 'Primary contact last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  contact_last_name: string;

  @ApiProperty({ description: 'Primary contact email address', example: 'john.doe@acme.com' })
  @IsEmail()
  @IsNotEmpty()
  contact_email: string;

  @ApiPropertyOptional({ description: 'Company phone number', example: '+1-555-123-4567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Company location', example: 'New York, NY' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Industry sector', example: 'Healthcare' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Business unit within the company', example: 'Virtual Care' })
  @IsOptional()
  @IsString()
  business_unit?: string;

  @ApiPropertyOptional({ description: 'Additional description or notes about the company', example: 'Interested in virtual assistant services' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'UUID of the user to whom this referral is directed', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  refer_to_user_id?: string;
}
