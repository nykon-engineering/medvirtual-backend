import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class forgotDto {
    
    @ApiProperty({ required: true, description: 'Email of the user requesting password recovery' })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}