import { ApiProperty } from "@nestjs/swagger"
import { IsDecimal, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class CreateBonusDto {
    @ApiProperty({ description: 'The ID of the staff member', required: true })
    @IsString()
    @IsNotEmpty()
    staff_id : string;

    @ApiProperty({ description: 'The value of the bonus', required: true })
    @IsDecimal()
    bonus: string;

    @ApiProperty({ description: 'The description of the bonus', required: false })
    @IsString()
    @IsOptional()
    description : string;
}
