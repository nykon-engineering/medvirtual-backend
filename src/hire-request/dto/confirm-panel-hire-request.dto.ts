import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ConfirmPanelHireRequestDto {
    @ApiProperty({ description: ' Hire Request ID', type: String,})
    @IsString()
    hireRequest_id: string;

    @ApiProperty({ description: 'Candidates IDs', type: [String] })
    candidates_id: string[];
}