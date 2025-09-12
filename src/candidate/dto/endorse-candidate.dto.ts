import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class EndorseCandidateDto  {
    @ApiProperty({ description: 'Candidate ID', required: true })
    @IsString()
    candidateId: string;

    @ApiProperty({ description: 'Hire Request Id', required: true })
    @IsString()
    hireRequestId: string;

    


}
