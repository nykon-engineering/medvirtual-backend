import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class changeStatusHireRequesDTO  {
    @ApiProperty({ example: 'awaiting_decision', description: 'The new status for specific card', required: true, type: String, enum: ['new', 'pending_signature', 'sourcing', 'for_review', 'panel_ready', 'interview_scheduled', 'awaiting_decision', 'placement_completed', 'cancelled'] })
    @IsString()
    status: 'new' | 'pending_signature' | 'sourcing' | 'for_review' | 'panel_ready' | 'interview_scheduled' | 'awaiting_decision' | 'placement_completed' | 'cancelled';

    @ApiProperty({ example: 'Client decided to cancel the request', description: 'The reason for cancelling the hire request', required: false, type: String })
    @IsString()
    @IsOptional()
    reason?: string;

    @ApiProperty({ example: '12345', description: 'staffing Coordinator to be updated on Hubspot', required: false, type: String })
    @IsString()
    @IsOptional()
    staffing_coordinator?: string;

    @ApiProperty({ example: true, description: 'Indicates if the pairing session was conducted', required: false, type: String })
    @IsString()
     @IsOptional()
    pairing_session_conducted?: String;

    @ApiProperty({ example: 'Candidate no-show', description: 'The outcome reason for the pairing session', required: false, type: String })
    @IsString()
    @IsOptional()
    pairing_session_outcome_reason?: string;
}
