import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LogoutDto {
    @ApiProperty({ required: true, description: 'The token to be revoked' })
    @IsString()
    token: string;
}
