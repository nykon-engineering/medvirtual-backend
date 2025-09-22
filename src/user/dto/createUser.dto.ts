import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @ApiProperty()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  role: string;

  @ApiProperty({
    required: false,
    description: 'Method used to create the user account',
  })
  @IsOptional()
  @IsEnum(['self_signup', 'admin_invite', 'system_created'])
  createdByMethod?: string;

  @ApiProperty({
    required: false,
    description: 'ID of the user who created this account',
  })
  @IsOptional()
  @IsString()
  createdByUserId?: string;
}
