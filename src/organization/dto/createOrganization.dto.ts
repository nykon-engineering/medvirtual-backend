import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsEmail, IsUrl, IsInt, IsDateString, IsEnum, IsArray } from "class-validator";
import { OrganizationRole, OrganizationStatus } from "@prisma/client";

export class CreateOrganizationDto {
  @ApiProperty({ required: true, description: 'Name of the organization' })
  @IsString()
  name: string;

  @ApiProperty({ required: true, description: 'Email address of the organization' })
  @IsEmail()
  email: string;

  @ApiProperty({ required: false, description: 'Phone number for the organization' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, description: 'Website URL of the organization' })
  @IsOptional()
  @IsUrl()
  website_url?: string;

  @ApiProperty({ required: false, description: 'Location/address of the organization' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false, description: 'Description of the organization' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, description: 'Industry of the organization' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ required: false, description: 'Number of employees', enum: OrganizationRole })
  @IsOptional()
  @IsEnum(OrganizationRole)
  organization_role?: OrganizationRole;

  @ApiProperty({ required: false, description: 'Number of employees' })
  @IsOptional()
  @IsInt()
  number_of_employees?: number;

  @ApiProperty({ required: false, description: 'Date the organization was founded' })
  @IsOptional()
  @IsDateString()
  date_founded?: string;

  @ApiProperty({ required: false, description: 'Date the organization joined' })
  @IsOptional()
  @IsDateString()
  date_joined?: string;

  @ApiProperty({ required: false, description: 'List of specialties' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiProperty({ required: false, description: 'List of services' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @ApiProperty({ required: false, description: 'Status of the organization', enum: OrganizationStatus })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @ApiProperty({ required: false, description: 'Email of the organization owner' })
  @IsOptional()
  @IsEmail()
  owner_email?: string;

  @ApiProperty({ required: false, description: 'ID of the assigned concierge (system admin)' })
  @IsOptional()
  @IsString()
  concierge_id?: string;
}
