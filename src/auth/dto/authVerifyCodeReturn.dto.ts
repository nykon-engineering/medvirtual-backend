import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { AuthGetInviteDto } from "./authGetInvite.dto";

export class AuthVerifyCodeDtoReturn {
    @ApiProperty({ required: true, description: 'Token for new session' })
    @IsString()
    token: string;
}