import { ApiProperty } from "@nestjs/swagger";
import { TicketStatus } from "@prisma/client";
import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class updateStatusTicketDto {
    @ApiProperty({ description: 'Status of origin', required: true, type: String, enum: Object.values(TicketStatus) })
    @IsString()
    @IsNotEmpty()
    @IsIn(Object.values(TicketStatus), { message: `Status must be one of the following values: ${Object.values(TicketStatus).join(', ')}` })
    status: string;
}
