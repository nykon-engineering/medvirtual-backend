import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';

export class InviteUserToOrganizationDto {
  @ApiProperty({ required: true, description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ required: true, description: 'User first name' })
  @IsString()
  first_name: string;

  @ApiProperty({ required: true, description: 'User last name' })
  @IsString()
  last_name: string;

  @ApiProperty({ required: false, description: 'User job title' })
  @IsOptional()
  @IsString()
  job_title?: string;

  @ApiProperty({ required: false, description: 'User phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    required: true,
    description: 'User role in the organization',
    enum: ['organization_admin', 'organization_super_admin'],
  })
  @IsEnum(['organization_admin', 'organization_super_admin'])
  role: string;

  @ApiProperty({
    required: false,
    description: 'Contact ID to associate with the new user',
  })
  @IsOptional()
  @IsString()
  contact_id?: string;
}
