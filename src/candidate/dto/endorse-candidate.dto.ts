import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

export class EndorseCandidateDto  {

    @ApiProperty({ description: 'Hire Request Id', required: true })
    @IsString()
    hireRequestId: string;

    @ApiProperty({ description: 'Candidates IDs', type: [String] })
    @IsArray()
    candidatesId: string[];


}
