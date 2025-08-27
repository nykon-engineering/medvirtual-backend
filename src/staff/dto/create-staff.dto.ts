import { ApiProperty } from "@nestjs/swagger"
import { Type } from "class-transformer"
import { IsDate, IsDecimal, IsNumber, IsString } from "class-validator"

export class CreateStaffDto {
    @ApiProperty({ description: 'The ID of the candidate', required: true })
    @IsString()
    candidate_id : string;

    @ApiProperty({ description: 'The ID of the hire request', required: true })
    @IsString()
    hirerequest_id : string;

    @ApiProperty({ description: 'The status of the staff', required: true })
    status : string;

    @ApiProperty({ description: 'The salary of the staff', required: true })
    @IsDecimal()
    salary: string;

    @ApiProperty({ example: '2024-07-01', description: 'The start date of the staff', required: true,  type: Date, format: 'date' })
    @IsDate()
    @Type(() => Date)
    start_date: Date;
}
