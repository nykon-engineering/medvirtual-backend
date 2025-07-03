import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class resendCodeDto{
    @ApiProperty({ required: true, description: 'The email to which the code will be resent' })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}