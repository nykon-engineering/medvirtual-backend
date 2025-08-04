import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateCandidateDto  {
    @ApiProperty({ description: 'First name of the candidate', required: false })
    @IsOptional()
    @IsString()
    first_name?: string;

    @ApiProperty({ description: 'Last name of the candidate', required: false })
    @IsOptional()
    @IsString()
    last_name?: string;

    @ApiProperty({ description: 'Email address of the candidate', required: false })
    @IsOptional()
    @IsString()
    email?: string;

    @ApiProperty({ description: 'Hourly pay rate of the candidate', required: false })
    @IsOptional()
    @IsString()
    hourly_pay_rate?: string;

    @ApiProperty({ description: 'Years of experience of the candidate', required: false })
    @IsOptional()
    @IsString()
    years_of_experience: number

    @ApiProperty({ description: 'Pipeline status of the candidate', required: false })
    @IsOptional()
    @IsString()
    pipeline_status?: string; 
}
