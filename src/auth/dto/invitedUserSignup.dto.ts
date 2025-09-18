import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AuthGetInviteDto } from './authGetInvite.dto';

export class AuthinvitedUserSignupDto extends AuthGetInviteDto {
  @ApiProperty({ required: false, description: 'First name provided by user' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false, description: 'Last name provided by user' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false, description: 'Job title provided by user' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiProperty({ required: true, description: 'password provided by user' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ required: false, description: 'status provided by frontend' })
  @IsOptional()
  @IsString()
  status?: string;
}
