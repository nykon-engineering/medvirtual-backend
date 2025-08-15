import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ConfirmPanelHireRequestDto {
    @ApiProperty({ description: 'Panel ID', type: String,})
    @IsString()
    panel_id: string;

    @ApiProperty({ description: 'Candidates IDs', type: [String] })
    candidates_id: string[];
}