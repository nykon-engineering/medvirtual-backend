import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class changeWinnerDTO{
    @ApiProperty({ description: 'ID of the candidate selected', required: true, type: String })
    @IsString()
    winner_id: string
}