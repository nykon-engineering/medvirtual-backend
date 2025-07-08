import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class signUpReturnDto {

    @ApiProperty({ required: true, description: 'The user email filled in the /sigunp page' })
    @IsEmail()
    token: string;
}
