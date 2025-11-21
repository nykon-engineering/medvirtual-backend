import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsIn,
  IsOptional,
} from 'class-validator';

export class CreateTalentPoolLeadDto {
  @ApiProperty({
    description: 'Name of the contact person',
    example: 'John Doe',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  name: string;

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
    description: 'Main need or requirement',
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
}

