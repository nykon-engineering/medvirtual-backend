import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { AuthGetInviteDto } from './authGetInvite.dto';

export class AuthSignUpReturnDto extends AuthGetInviteDto {}
