import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetOrganizationUsersDto {
  @ApiProperty({
    required: false,
    description: 'Page number',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    required: false,
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    required: false,
    description: 'Search term for name, email, or job title',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'Filter by user role' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by user status',
    enum: ['active', 'inactive', 'invited', 'suspended'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'invited', 'suspended'])
  status?: string;

  @ApiProperty({
    required: false,
    description: 'Sort by field',
    enum: [
      'createdAt',
      'updatedAt',
      'first_name',
      'last_name',
      'email',
      'role',
    ],
  })
  @IsOptional()
  @IsEnum([
    'createdAt',
    'updatedAt',
    'first_name',
    'last_name',
    'email',
    'role',
  ])
  sortBy?: string = 'createdAt';

  @ApiProperty({
    required: false,
    description: 'Sort order',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
