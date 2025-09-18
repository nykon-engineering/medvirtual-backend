import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class changeStatusHireRequesDTO  {
    @ApiProperty({ example: 'awaiting_decision', description: 'The new status for specific card', required: true, type: String, enum: ['new', 'pending_signature', 'sourcing', 'panel_ready', 'interview_scheduled', 'awaiting_decision', 'placement_completed', 'cancelled'] })
    @IsString()
    status: 'new' | 'pending_signature' | 'sourcing' | 'panel_ready' | 'interview_scheduled' | 'awaiting_decision' | 'placement_completed' | 'cancelled';

}
