import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { AuthGetInviteDto } from './authGetInvite.dto';

export class AuthSetPasswordDto extends AuthGetInviteDto {
  @ApiProperty({ required: true, description: 'First name provided by user' })
  @IsString()
  firstName: string;

  @ApiProperty({ required: true, description: 'Last name provided by user' })
  @IsString()
  lastName: string;

  @ApiProperty({ required: true, description: 'Job title provided by user' })
  @IsString()
  jobTitle: string;

  @ApiProperty({ required: true, description: 'password provided by user' })
  @IsString()
  password: string;

}
