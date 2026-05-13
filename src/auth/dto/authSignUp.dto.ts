import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { AuthInviteUserDto } from './authInviteUser.dto';

export class AuthSignUpDto extends AuthInviteUserDto {
  @ApiProperty({ required: true, description: 'User first name' })
  @IsString()
  firstName: string;

  @ApiProperty({ required: true, description: 'User last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ required: true, description: 'User password' })
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false, description: 'User job title' })
  @IsString()
  jobTitle: string;
}
