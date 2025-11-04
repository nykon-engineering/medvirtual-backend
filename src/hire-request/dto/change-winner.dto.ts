import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

export class changeWinnerDTO{
    @ApiProperty({ description: 'IDs of the candidate selected', required: true, type: [String] })
    @IsArray()
    @IsString({ each: true })
    winner_id: string[];
}