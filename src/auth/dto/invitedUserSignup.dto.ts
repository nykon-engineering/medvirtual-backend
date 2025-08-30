import { ApiProperty } from '@nestjs/swagger';
import { isNotEmpty, IsNotEmpty, IsString } from 'class-validator';
import { AuthGetInviteDto } from './authGetInvite.dto';

export class AuthinvitedUserSignupDto extends AuthGetInviteDto {
  @ApiProperty({ required: true, description: 'First name provided by user' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ required: true, description: 'Last name provided by user' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ required: true, description: 'Job title provided by user' })
  @IsString()
  jobTitle: string;

  @ApiProperty({ required: true, description: 'password provided by user' })
  @IsString()
  password: string;

  @ApiProperty({ required: true, description: 'status provided by frontend' })
  @IsString()
  status: string;
}
