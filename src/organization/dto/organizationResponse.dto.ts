import { ApiProperty } from '@nestjs/swagger';
import { OrganizationRole, OrganizationStatus } from '@prisma/client';

export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of items' })
  total: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  hasPrev: boolean;
}

export class OrganizationResponseDto {
  @ApiProperty({ description: 'Organization ID' })
  id: string;

  @ApiProperty({ description: 'Organization name' })
  name: string;

  @ApiProperty({ description: 'Organization email', required: false })
  email?: string;

  @ApiProperty({ description: 'Organization phone', required: false })
  phone?: string;

  @ApiProperty({ description: 'Organization website URL', required: false })
  website_url?: string;

  @ApiProperty({ description: 'Organization location', required: false })
  location?: string;

  @ApiProperty({ description: 'Organization description', required: false })
  description?: string;

  @ApiProperty({ description: 'Organization industry', required: false })
  industry?: string;

  @ApiProperty({ description: 'Organization role', enum: OrganizationRole })
  organization_role: OrganizationRole;

  @ApiProperty({ description: 'Number of employees', required: false })
  number_of_employees?: number;

  @ApiProperty({ description: 'Date founded', required: false })
  date_founded?: Date;

  @ApiProperty({ description: 'Date joined', required: false })
  date_joined?: Date;

  @ApiProperty({ description: 'Date became client', required: false })
  date_became_client?: Date;

  @ApiProperty({ description: 'Organization status', enum: OrganizationStatus })
  status: OrganizationStatus;

  @ApiProperty({ description: 'Signed document URL', required: false })
  signed_document_url?: string;

  @ApiProperty({ description: 'Signed document date', required: false })
  signed_document_date?: Date;

  @ApiProperty({ description: 'Organization specialties', required: false })
  specialties?: string[];

  @ApiProperty({ description: 'Organization services', required: false })
  services?: string[];

  @ApiProperty({ description: 'Owner ID', required: false })
  owner_id?: string;

  @ApiProperty({ description: 'Concierge ID', required: false })
  concierge_id?: string;

  @ApiProperty({ description: 'Organization creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Organization last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Owner information', required: false })
  owner?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    job_title?: string;
    phone?: string;
  };

  @ApiProperty({ description: 'Concierge information', required: false })
  concierge?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    job_title?: string;
    phone?: string;
  };

  @ApiProperty({ description: 'Number of users in organization' })
  userCount: number;
}

export class PaginatedOrganizationsResponseDto {
  @ApiProperty({
    description: 'Array of organizations',
    type: [OrganizationResponseDto],
  })
  data: OrganizationResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
