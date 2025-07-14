import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { AuthGetInviteDto } from './authGetInvite.dto';

export class AuthLogoutDto extends AuthGetInviteDto {}
