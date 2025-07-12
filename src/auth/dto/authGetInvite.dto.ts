import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AuthGetInviteDto {
  @ApiProperty({ required: true, description: 'Token used to retrieve invite info' })
  @IsString()
  token: string;
}
