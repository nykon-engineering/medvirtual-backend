import { ApiProperty } from '@nestjs/swagger';

export class OrganizationUserDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiProperty({ description: 'First name' })
  first_name: string;

  @ApiProperty({ description: 'Last name' })
  last_name: string;

  @ApiProperty({ description: 'Full name' })
  full_name: string;

  @ApiProperty({ description: 'Phone number' })
  phone: string;

  @ApiProperty({ description: 'Avatar URL or default avatar' })
  avatar: string;

  @ApiProperty({ description: 'Job title' })
  job_title: string;

  @ApiProperty({ description: 'User role' })
  role: string;

  @ApiProperty({ description: 'User status' })
  status: string;

  @ApiProperty({ description: 'Verification status' })
  verified: boolean;

  @ApiProperty({ description: 'Organization ID' })
  organization_id: string;

  @ApiProperty({ description: 'Organization name' })
  organization_name: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}

export class PaginatedOrganizationUsersResponseDto {
  @ApiProperty({
    description: 'Array of organization users',
    type: [OrganizationUserDto],
  })
  users: OrganizationUserDto[];

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of users' })
  total: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  hasPrev: boolean;
}
