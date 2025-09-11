import { ApiProperty, ApiResponse } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsDate, IsOptional, IsString } from "class-validator";

export class HireRequestSkillDTO {
    @ApiProperty({ example: 'JavaScript', description: 'The name of the skill', required: true, type: String })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Expert', description: 'The level of the skill', required: true, type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'] })
    @IsString()
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export class CreateHireRequestDto {

    @ApiProperty({ example: 'Software Engineer', description: 'The title of the hire request', required: true,  type: String })
    @IsString()
    title: string;

    @ApiProperty({ example: '1234567890', description: 'The client ID for the hire request', required: false,  type: String })
    @IsString()
    @IsOptional()
    client_id: string;

    @ApiProperty({ example: 'Engineering', description: 'The specialization for the hire request', required: true,  type: String })
    @IsString()
    specialization: string;

    @ApiProperty({ example: 'Full-time, Part-time, On-demand, any', description: 'The availability for the hire request', required: true,  type: String, enum: ['Full-time', 'Part-time', 'On-demand', 'any'] })
    @IsString()
    availability: string;

    @ApiProperty({ example: 'We are looking for a skilled software engineer to join our team...', description: 'The description of the hire request', required: false,  type: String })
    @IsString()
    @IsOptional()
    description: string;

    @ApiProperty({ example: '2024-07-01', description: 'The expected start date for the hire request', required: true,  type: Date, format: 'date' })
    @IsDate()
    @Type(() => Date)
    expected_start_date: Date;

    @ApiProperty({ example: '6 months', description: 'The contract length for the hire request', required: false,  type: String })
    @IsString()
    @IsOptional()
    contract_length: string;

    @ApiProperty({ example: '50000', description: 'The salary range from for the hire request', required: true,  type: String })
    @IsString()
    salary_range_from: string;

    @ApiProperty({ example: '70000', description: 'The salary range to for the hire request', required: true,  type: String })
    @IsString()
    salary_range_to: string;

    @ApiProperty({ example: 'New York, Remote', description: 'The work location for the hire request', required: false,  type: String })
    @IsString()
    @IsOptional()
    location: string;

    @ApiProperty({ example: 'high, medium, low', description: 'The priority of the hire request', required: true,  type: String, enum: ['high', 'medium', 'low'] })
    @IsString()
    priority: 'high' | 'medium' | 'low';

    @ApiProperty({ type: [HireRequestSkillDTO], description: 'The skills required for the hire request', required: false })
    @IsArray()
    @IsOptional()
    skills: HireRequestSkillDTO[];
}

