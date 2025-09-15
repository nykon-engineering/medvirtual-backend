import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsDecimal,
  IsIn,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { staffStatusDictionary } from '../../common/dictionaries/staff-status-dictionary';
import { ProficiencyLevel, SkillType } from '@prisma/client';

export class UpdateStaffSkillDto {
  @ApiProperty({ description: 'Skill name', required: true })
  @IsString()
  skill_name: string;

  @ApiProperty({
    description: 'Proficiency level',
    required: false,
    enum: ProficiencyLevel,
    default: ProficiencyLevel.intermediate,
  })
  @IsOptional()
  @IsEnum(ProficiencyLevel)
  proficiency_level?: ProficiencyLevel;

  @ApiProperty({
    description: 'Skill type',
    required: false,
    enum: SkillType,
    default: SkillType.technical,
  })
  @IsOptional()
  @IsEnum(SkillType)
  skill_type?: SkillType;
}

export class UpdateStaffLanguageDto {
  @ApiProperty({ description: 'Language name', required: true })
  @IsString()
  name: string;
}

export class UpdateStaffDto {
  @ApiProperty({
    description: 'The status of the staff',
    required: false,
    enum: Object.keys(staffStatusDictionary),
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.keys(staffStatusDictionary), {
    message: `Status must be one of the following values: ${Object.keys(staffStatusDictionary).join(', ')}`,
  })
  status?: string;

  @ApiProperty({ description: 'The salary of the staff', required: false })
  @IsOptional()
  @IsDecimal()
  salary?: string;

  @ApiProperty({
    example: '2024-07-01',
    description: 'The start date of the staff',
    required: false,
    type: Date,
    format: 'date',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  start_date?: Date;

  // Candidate details
  @ApiProperty({ description: 'First name', required: false })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiProperty({ description: 'Last name', required: false })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({ description: 'Email', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: 'About me', required: false })
  @IsOptional()
  @IsString()
  about_me?: string;

  @ApiProperty({ description: 'Specialization', required: false })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiProperty({ description: 'Employment type', required: false })
  @IsOptional()
  @IsString()
  employment_type?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ description: 'Years of experience', required: false })
  @IsOptional()
  @Type(() => Number)
  years_of_experience?: number;

  @ApiProperty({ description: 'Hourly pay rate', required: false })
  @IsOptional()
  @IsDecimal()
  hourly_pay_rate?: string;

  @ApiProperty({ description: 'Gender', required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ description: 'Medical tools', required: false })
  @IsOptional()
  @IsString()
  medical_tools?: string;

  @ApiProperty({ description: 'Tools', required: false })
  @IsOptional()
  @IsString()
  tools?: string;

  // Skills array
  @ApiProperty({
    description: 'Skills array',
    required: false,
    type: [UpdateStaffSkillDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateStaffSkillDto)
  skills?: UpdateStaffSkillDto[];

  // Languages array
  @ApiProperty({
    description: 'Languages array',
    required: false,
    type: [UpdateStaffLanguageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateStaffLanguageDto)
  languages?: UpdateStaffLanguageDto[];
}
