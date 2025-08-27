import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { ticketTypeDictionary } from "../../common/dictionaries/ticket-type";
import { Priority } from "@prisma/client";

export class CreateTicketDto {
    @ApiProperty({ description: 'ID of the tickets organization', required: true, type: String })
    @IsString()
    client_id: string;

    @ApiProperty({ description: 'Type of the ticket', required: true, type: String, enum: Object.keys(ticketTypeDictionary) })
    @IsString()
    @IsIn(Object.keys(ticketTypeDictionary), { message: `Type must be one of the following values: ${Object.keys(ticketTypeDictionary).join(', ')}` })
    type: string;

    @ApiProperty({ description: 'Title of the ticket', required: true, type: String })
    @IsString()
    title: string;

    @ApiProperty({ description: 'Description of the ticket', required: true, type: String })
    @IsString()
    description: string;

    @ApiProperty({ description: 'Priority of the ticket', required: true, type: String, enum: Object.values(Priority) })
    @IsString()
    @IsIn(Object.values(Priority), { message: `Priority must be one of the following values: ${Object.values(Priority).join(', ')}` })
    priority: Priority;

    @ApiProperty({ description: 'ID of the user assigned to the ticket', required: true, type: String })
    @IsString()
    @IsOptional()
    assigned_user_id: string;
}
