import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { AuthGetInviteDto } from './authGetInvite.dto';

export class AuthSetPasswordDto extends AuthGetInviteDto {
  
  @ApiProperty({ required: true, description: 'password provided by user' })
  @IsString()
  password: string;

}
