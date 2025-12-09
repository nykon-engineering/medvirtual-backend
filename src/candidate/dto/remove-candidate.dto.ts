import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class RemoveCandidateDto  {

    @ApiProperty({ description: 'Hire Request Id', required: true })
    @IsString()
    hireRequestId: string;

    @ApiProperty({ description: 'Candidates IDs', required: true })
    @IsString()
    candidateId: string;


}
