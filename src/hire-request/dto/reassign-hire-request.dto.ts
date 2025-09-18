import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class reassignDTO {
    @ApiProperty({ example: 'user_id', description: 'The ID of the user to whom the hire request is reassigned', required: false, type: String })
    @IsString()
    @IsOptional()
    user_id?: string;
}