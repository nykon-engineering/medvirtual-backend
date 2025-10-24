import { DateTime } from "@hubspot/api-client/lib/codegen/crm/associations/v4";
import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class editInterviewDTO{

    @ApiProperty({ description: 'The date of the interview', type:String, required: true })
    @IsString()
    date_time: DateTime;

    @ApiProperty({ description: 'The link of the interview', example: 'https://meet.google.com/XXXX', required: false })
    @IsString()
    interview_link: string;
}