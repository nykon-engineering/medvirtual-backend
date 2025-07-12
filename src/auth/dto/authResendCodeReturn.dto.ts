import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { AuthGetInviteDto } from './authGetInvite.dto';

export class AuthResendCodeReturnDto extends AuthGetInviteDto {}
