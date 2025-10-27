import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchUsersDto {
  @ApiProperty({
    required: false,
    description: 'Search term to filter users by name, email, or job title',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by user role',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by user status',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by organization ID',
  })
  @IsOptional()
  @IsString()
  organization_id?: string;

  @ApiProperty({
    required: false,
    description: 'Number of results to return (no maximum limit)',
    minimum: 1,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
