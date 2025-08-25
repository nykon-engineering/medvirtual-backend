import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CreateTicketDto {

    @ApiProperty({ description: 'ID of the tickets organization', required: true, type: String })
    @IsString()
    client_id: string;

    @ApiProperty({ description: 'Type of the ticket', required: true, type: String })
    @IsString()
    type: string;

    @ApiProperty({ description: 'Title of the ticket', required: true, type: String })
    @IsString()
    title: string;
    @ApiProperty({ description: 'Description of the ticket', required: true, type: String })
    @IsString()
    description: string;

    @ApiProperty({ description: 'Priority of the ticket', required: true, type: String })
    @IsString()
    priority: string;

    @ApiProperty({ description: 'ID of the user assigned to the ticket', required: true, type: String })
    @IsString()
    assign_id: string;
}
