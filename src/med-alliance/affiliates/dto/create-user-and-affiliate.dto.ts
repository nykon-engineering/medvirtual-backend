import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserAndAffiliateProfileDto {

  @ApiProperty({ description: 'Email address for the new user account', example: 'jane.doe@hospital.com' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'First name of the new user', example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ description: 'Last name of the new user', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({ description: 'Platform role to assign to the new user', example: 'affiliate' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiPropertyOptional({ description: 'Phone number for the new user', example: '+1 555 123 4567' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({ description: 'Company or organization name associated with the affiliate', example: 'Sunshine Healthcare Group' })
  @IsOptional()
  @IsString()
  company_name?: string;
}
