import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class reassignDTO {
    @ApiProperty({ example: 'user_id', description: 'The ID of the user to whom the hire request is reassigned', required: true, type: String })
    @IsString()
    user_id: string;
}