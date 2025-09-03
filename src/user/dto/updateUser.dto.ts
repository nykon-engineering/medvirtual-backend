import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ required: false, description: 'User first name' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiProperty({ required: false, description: 'User last name' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({ required: false, description: 'User email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, description: 'User phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, description: 'User job title' })
  @IsOptional()
  @IsString()
  job_title?: string;

  @ApiProperty({ required: false, description: 'User role' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({
    required: false,
    description: 'User status',
    enum: ['active', 'inactive', 'invited', 'suspended'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'invited', 'suspended'])
  status?: string;

  @ApiProperty({ required: false, description: 'User avatar URL' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({ required: false, description: 'Organization name' })
  @IsOptional()
  @IsString()
  organization_name?: string;
}
