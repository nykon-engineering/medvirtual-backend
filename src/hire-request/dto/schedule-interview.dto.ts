import { DateTime } from "@hubspot/api-client/lib/codegen/crm/associations/v4";
import { ApiProperty } from "@nestjs/swagger";
import { IsDate, IsString } from "class-validator";

export class scheduleInterviewDTO{

    @ApiProperty({ description: 'The date of the interview', type:String, required: true })
    @IsString()
    date_time: DateTime;
}