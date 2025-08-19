import { ApiProperty } from "@nestjs/swagger";
import { IsDate, IsString } from "class-validator";

export class scheduleInterviewDTO{

    @ApiProperty({ description: 'The date of the interview', type:String, example: '2023-10-01', required: true })
    @IsString()
    date: Date;

    @ApiProperty({ description: 'The time of the interview in the 24 hour format', type:String, example: '15:00', required: true })
    @IsString()
    time: String;
}