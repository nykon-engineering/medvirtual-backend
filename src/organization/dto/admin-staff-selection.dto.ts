import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDate, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { staffStatusDictionary } from '../../common/dictionaries/staff-status-dictionary';

export class GetCandidatesForAdminDto {
  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  perPage?: number = 20;

  @ApiProperty({
    description: 'Search term for candidate name or email',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Filter by specialization', required: false })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiProperty({ description: 'Filter by employment type', required: false })
  @IsOptional()
  @IsString()
  employment_type?: string;

  @ApiProperty({ description: 'Filter by country', required: false })
  @IsOptional()
  @IsString()
  country?: string;
}

export class GetHireRequestsForAdminDto {
  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  perPage?: number = 20;

  @ApiProperty({
    description: 'Search term for hire request title',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Filter by status', required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ description: 'Filter by specialization', required: false })
  @IsOptional()
  @IsString()
  specialization?: string;
}

export class AdminCreateStaffWithHireRequestDto {
  @ApiProperty({ description: 'Organization ID', required: true })
  @IsString()
  organization_id: string;

  @ApiProperty({ description: 'The ID of the candidate', required: true })
  @IsString()
  candidate_id: string;

  @ApiProperty({
    description: 'The ID of the hire request (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  hirerequest_id?: string;

  @ApiProperty({
    description: 'The status of the staff',
    required: true,
    enum: Object.keys(staffStatusDictionary),
  })
  @IsString()
  @IsIn(Object.keys(staffStatusDictionary), {
    message: `Status must be one of the following values: ${Object.keys(staffStatusDictionary).join(', ')}`,
  })
  status: string;

  @ApiProperty({ description: 'The salary of the staff', required: true })
  @IsString()
  salary: string;

  @ApiProperty({
    example: '2024-07-01',
    description: 'The start date of the staff',
    required: true,
    type: Date,
    format: 'date',
  })
  @IsDate()
  @Type(() => Date)
  start_date: Date;

  // Hire Request fields (used when creating new hire request)
  @ApiProperty({
    description: 'Hire request title (required if no existing hire request)',
    required: false,
  })
  @IsOptional()
  @IsString()
  hire_request_title?: string;

  @ApiProperty({ description: 'Hire request description', required: false })
  @IsOptional()
  @IsString()
  hire_request_description?: string;

  @ApiProperty({ description: 'Hire request specialization', required: false })
  @IsOptional()
  @IsString()
  hire_request_specialization?: string;

  @ApiProperty({ description: 'Hire request location', required: false })
  @IsOptional()
  @IsString()
  hire_request_location?: string;

  @ApiProperty({
    description: 'Hire request priority',
    required: false,
    enum: ['low', 'medium', 'high'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high'], {
    message: 'Priority must be one of: low, medium, high',
  })
  hire_request_priority?: 'low' | 'medium' | 'high';

  @ApiProperty({ description: 'Hire request availability', required: false })
  @IsOptional()
  @IsString()
  hire_request_availability?: string;

  @ApiProperty({ description: 'Hire request contract length', required: false })
  @IsOptional()
  @IsString()
  hire_request_contract_length?: string;

  @ApiProperty({
    description: 'Hire request expected start date',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  hire_request_expected_start_date?: Date;

  @ApiProperty({
    description: 'Hire request salary range from',
    required: false,
  })
  @IsOptional()
  @IsString()
  hire_request_salary_range_from?: string;

  @ApiProperty({ description: 'Hire request salary range to', required: false })
  @IsOptional()
  @IsString()
  hire_request_salary_range_to?: string;
}

export class CandidateSelectionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  first_name: string;

  @ApiProperty()
  last_name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  specialization: string;

  @ApiProperty()
  employment_type: string;

  @ApiProperty()
  country: string;

  @ApiProperty()
  about_me: string;

  @ApiProperty()
  languages: Array<{ name: string }>;

  @ApiProperty()
  skills: Array<{ skill_name: string }>;

  @ApiProperty()
  createdAt: string;
}

export class HireRequestSelectionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  priority: string;

  @ApiProperty()
  specialization: string;

  @ApiProperty()
  location: string;

  @ApiProperty()
  availability: string;

  @ApiProperty()
  contract_length: string;

  @ApiProperty()
  expected_start_date: string;

  @ApiProperty()
  salary_range_from: string;

  @ApiProperty()
  salary_range_to: string;

  @ApiProperty()
  createdAt: string;
}
