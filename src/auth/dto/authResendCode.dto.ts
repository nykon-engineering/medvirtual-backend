import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class AuthResendCodeDto{
    @ApiProperty({ required: true, description: 'The email to which the code will be resent' })
    @IsEmail()
    @IsNotEmpty()
    token: string;
}