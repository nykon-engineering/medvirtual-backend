import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsDate, IsNumber, IsOptional, IsString } from "class-validator";

export class HireRequestSkillDTO {
    @ApiProperty({ example: 'JavaScript', description: 'The name of the skill', required: true, type: String })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Expert', description: 'The level of the skill', required: true, type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'] })
    @IsString()
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export class UpdateHireRequestDto {

    @ApiProperty({ example: 'Software Engineer', description: 'The title of the hire request', required: true,  type: String })
    @IsString()
    title: string;

    @ApiProperty({ example: '1234567890', description: 'The client ID for the hire request', required: false,  type: String })
    @IsString()
    @IsOptional()
    client_id: string;

    @ApiProperty({ example: 'Engineering', description: 'The specialization for the hire request', required: false,  type: String })
    @IsString()
    @IsOptional()
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


    @ApiProperty({ example: '50000', description: 'The salary range from for the hire request', required: false,  type: String })
    @IsString()
    @IsOptional()
    salary_range_from: string;

    @ApiProperty({ example: '70000', description: 'The salary range to for the hire request', required: false,  type: String })
    @IsString()
    @IsOptional()
    salary_range_to: string;

    @ApiProperty({ example: 'New York, Remote', description: 'The work location for the hire request', required: false,  type: String })
    @IsString()
    @IsOptional()
    location: string;

    @ApiProperty({ example: '6000', description: 'The contract amount', required: false,  type: String })
    @IsString()
    @IsOptional()
    hubspot_contract_amount: string;

    @ApiProperty({ example: 'English', description: 'The language required for this position', required: false,  type: String })
    @IsString()
    @IsOptional()
    hubspot_language: string;

    @ApiProperty({ example: '1', description: 'The number of candidates required on this position', required: false,  type: Number })
    @IsNumber()
    @IsOptional()
    hubspot_numberVA: number;

    @ApiProperty({ example: 'Medical General', description: 'The position required on this position', required: false,  type: String })
    @IsString()
    @IsOptional()
    hubspot_role_type: string;

    @ApiProperty({ example: 'high, medium, low', description: 'The priority of the hire request', required: false,  type: String, enum: ['high', 'medium', 'low'] })
    @IsString()
    @IsOptional()
    priority: 'high' | 'medium' | 'low';

    @ApiProperty({ type: [HireRequestSkillDTO], description: 'The skills required for the hire request', required: false })
    @IsArray()
    @IsOptional()
    skills: HireRequestSkillDTO[];

    @ApiProperty({ type: String, description: 'Expected Tasks & Scope of Support', required: false })
    @IsString()
    @IsOptional()
    hubspot_tasks: string

    @ApiProperty({ type: String, description: '2 monitors required [Yes/No]', required: false })
    @IsString()
    @IsOptional()
    hubspot_n2_monitors_required: string

    @ApiProperty({ type: String, description: 'VA Shift hours', required: false })
    @IsString()
    @IsOptional()
    hubspot_va_shift_hours: string

    @ApiProperty({ type: String, description: 'Tools Familiarization', required: false })
    @IsString()
    @IsOptional()
    hubspot_tools_familiarization: string

    @ApiProperty({ type: String, description: 'Training Request Notes', required: false })
    @IsString()
    @IsOptional()
    hubspot_training_request_notes: string

    @ApiProperty({ type: String, description: 'Camera On During Shift', required: false })
    @IsString()
    @IsOptional()
    hubspot_camera_on_during_shift: string

    @ApiProperty({ type: String, description: 'Special Sourcing Needed[Yes/No]', required: false })
    @IsString()
    @IsOptional()
    hubspot_special_sourcing_needed: string

    @ApiProperty({ type: String, description: 'Special Sourcing Request (Specific Role)', required: false })
    @IsString()
    @IsOptional()
    hubspot_special_requirements: string

    @ApiProperty({ type: String, description: 'Additional Training Requested[Yes/No]', required: false })
    @IsString()
    @IsOptional()
    hubspot_additional_training_requested: string

    @ApiProperty({ type: String, description: 'Pairing Date', required: false })
    @IsString()
    @IsOptional()
    hubspot_pairing_date: string

    @ApiProperty({ type: String, description: 'Pairing Time', required: false })
    @IsString()
    @IsOptional()
    hubspot_pairing_time: string

    @ApiProperty({ type: String, description: 'Pairing Request Type', required: false })
    @IsString()
    @IsOptional()
    hubspot_pairing_request_type: string

}

