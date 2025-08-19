import { ApiProperty } from "@nestjs/swagger";
import { IsDate, IsString } from "class-validator";

export class awaitingDecisionDTO{

    @ApiProperty({ description: 'The end date of the Panel', type:String, example: '2023-10-01', required: true })
    @IsString()
    date: Date;

    @ApiProperty({ description: 'The end time of the Panel', type:String, example: '15:00', required: true })
    @IsString()
    time: String;
}