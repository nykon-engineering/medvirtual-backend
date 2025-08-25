import { DateTime } from "@hubspot/api-client/lib/codegen/crm/associations/v4";
import { ApiProperty } from "@nestjs/swagger";
import { IsDate, IsString } from "class-validator";

export class awaitingDecisionDTO{

    @ApiProperty({ description: 'The end date of the Panel', type:String, example: '2023-10-01', required: true })
    @IsString()
    date_time: DateTime;
}