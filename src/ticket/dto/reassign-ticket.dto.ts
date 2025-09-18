import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class reassignTicketDto {
    @ApiProperty({ description: 'ID of the user assigned to the ticket', required: false, type: String })
    @IsString()
    @IsOptional()
    assigned_user_id: string ;
}
