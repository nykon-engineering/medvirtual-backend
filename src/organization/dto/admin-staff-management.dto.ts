import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDate, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { staffStatusDictionary } from '../../common/dictionaries/staff-status-dictionary';

export class GetOrganizationStaffDto {
  //   @ApiProperty({ description: 'Organization ID', required: true })
  //   @IsString()
  //   organization_id: string;

  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', required: false, default: 10 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  perPage?: number = 10;

  @ApiProperty({ description: 'Search term', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Start date from', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  start_date_from?: Date;

  @ApiProperty({ description: 'Start date to', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  start_date_to?: Date;

  @ApiProperty({
    description: 'Filter by staff status',
    required: false,
    enum: Object.keys(staffStatusDictionary),
    example: 'Active',
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.keys(staffStatusDictionary), {
    message: `Status must be one of the following values: ${Object.keys(staffStatusDictionary).join(', ')}`,
  })
  status?: string;
}

export class AdminCreateStaffDto {
  @ApiProperty({ description: 'Organization ID', required: true })
  @IsString()
  organization_id: string;

  @ApiProperty({ description: 'The ID of the candidate', required: true })
  @IsString()
  candidate_id: string;

  @ApiProperty({ description: 'The ID of the hire request', required: true })
  @IsString()
  hirerequest_id: string;

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
}

export class AdminStaffResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  hirerequest_id: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  salary: string;

  @ApiProperty()
  start_date: Date;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiProperty()
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    specialization: string;
    employment_type: string;
    country: string;
    about_me: string;
    languages: Array<{ name: string }>;
    skills: Array<{ skill_name: string }>;
    createdAt: Date;
  };

  @ApiProperty()
  hireRequest: {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    availability: string;
    contract_length: string;
    expected_start_date: Date;
    salary_range_from: string;
    salary_range_to: string;
    specialization: string;
    location: string;
  };

  @ApiProperty()
  bonus: Array<{
    id: string;
    amount: string;
    description: string;
    created_at: Date;
    created_by: string;
  }>;
}
