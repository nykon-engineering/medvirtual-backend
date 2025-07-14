import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { AuthGetInviteDto } from "./authGetInvite.dto";

export class AuthVerifyCodeDto {
    @ApiProperty({ required: true, description: 'The code to verify' })
    @IsString()
    code: string;

    @ApiProperty({ required: true, description: 'Token to validate user' })
    @IsString()
    token: string;
}