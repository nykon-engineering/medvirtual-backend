import { ApiProperty } from "@nestjs/swagger"
import { IsDecimal, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class terminateDto {
    @ApiProperty({ description: 'The ID of the staff member', required: true })
    @IsString()
    @IsNotEmpty()
    staff_id : string;

    @ApiProperty({ description: 'The description of the termination', required: false })
    @IsString()
    @IsOptional()
    description : string;
}
