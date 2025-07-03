import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsStrongPassword } from "class-validator";

export class ResetPasswordDto {
    @ApiProperty({ required: true, description: 'The authentication code hash' })
    @IsString()
    @IsNotEmpty()
    hash: string;

    @ApiProperty({ required: true, description: 'The new password to set' })
    @IsStrongPassword()
    @IsNotEmpty()
    newPassword: string;
}