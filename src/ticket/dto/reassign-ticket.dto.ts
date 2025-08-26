import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class reassignTicketDto {
    @ApiProperty({ description: 'ID of the user assigned to the ticket', required: true, type: String })
    @IsString()
    @IsNotEmpty()
    assigned_user_id: string;
}
