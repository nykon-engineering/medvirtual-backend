import { ApiProperty } from '@nestjs/swagger';
import { MinLength } from 'class-validator';
import { AuthInviteUserDto } from './authInviteUser.dto';

export class AuthSignUpDto extends AuthInviteUserDto {

  @ApiProperty({ required: true, description: 'User password' })
  @MinLength(6)
  password: string;

  
}
