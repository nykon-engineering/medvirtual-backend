import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User first name' })
  first_name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User last name' })
  last_name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User phone number' })
  phone?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User avatar URL' })
  avatar?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User job title' })
  job_title?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User organization name' })
  organization_name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'User organization description',
  })
  organization_description?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'User role' })
  role?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, description: 'User verification status' })
  verified?: boolean;
}
