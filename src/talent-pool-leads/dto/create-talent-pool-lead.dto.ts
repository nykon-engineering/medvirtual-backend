import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsIn,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateTalentPoolLeadDto {
  @ApiProperty({
    description: 'First name of the contact person',
    example: 'John',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(2, { message: 'First name must be at least 2 characters long' })
  first_name: string;

  @ApiProperty({
    description: 'Last name of the contact person',
    example: 'Doe',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(2, { message: 'Last name must be at least 2 characters long' })
  last_name: string;

  @ApiProperty({
    description: 'Email address of the contact person',
    example: 'john@healthcare.com',
    required: true,
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Organization name',
    example: 'Healthcare Organization Name',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Organization must be at least 2 characters long' })
  organization: string;

  @ApiProperty({
    description: 'Company website URL',
    example: 'https://www.healthcare.com',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Website URL is required' })
  @Matches(
    /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    { message: 'Please enter a valid website URL' },
  )
  website_url: string;

  @ApiProperty({
    description: 'Language preference - Are your patients bilingual (English/Spanish)?',
    example: 'yes',
    enum: ['yes', 'no'],
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Language preference is required' })
  @IsIn(['yes', 'no'], {
    message: 'Language preference must be either "yes" or "no"',
  })
  language_preference: string;

  @ApiProperty({
    description: 'Main need or requirement (deprecated - kept for backward compatibility)',
    example: 'E.g: 3 bilingual VAs for telemedicine',
    required: false,
  })
  @IsOptional()
  @IsString()
  main_need?: string;

  @ApiProperty({
    description: 'Additional details about the requirement',
    example: 'Monthly volume, specialties, schedules, or critical certifications...',
    required: false,
  })
  @IsOptional()
  @IsString()
  additional_details?: string;

  @ApiProperty({
    description: 'Source of the lead',
    example: 'talent-pool-page',
    enum: ['talent-pool-page', 'berry-talent-pool-page'],
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['talent-pool-page', 'berry-talent-pool-page'], {
    message: 'Source must be either "talent-pool-page" or "berry-talent-pool-page"',
  })
  source: string;

  @ApiProperty({
    description: 'ID of the talent pool candidate the visitor was viewing when they submitted the form',
    example: 'abc123',
    required: false,
  })
  @IsOptional()
  @IsString()
  candidate_id?: string;
}
