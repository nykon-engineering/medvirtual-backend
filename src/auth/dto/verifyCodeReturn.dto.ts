import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class verifyCodeDtoReturn{
    @ApiProperty({ required: true, description: 'The code to verify' })
    @IsString()
    token: string;
}