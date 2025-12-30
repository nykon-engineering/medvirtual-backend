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
}
