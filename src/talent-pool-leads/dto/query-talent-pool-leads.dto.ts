import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryTalentPoolLeadsDto {
  @ApiProperty({
    description: 'Filter by status',
    example: 'new',
    enum: ['new', 'contacted', 'qualified', 'converted', 'rejected'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['new', 'contacted', 'qualified', 'converted', 'rejected'])
  status?: string;

  @ApiProperty({
    description: 'Filter by source',
    example: 'talent-pool-page',
    enum: ['talent-pool-page', 'berry-talent-pool-page'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['talent-pool-page', 'berry-talent-pool-page'])
  source?: string;

  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of results per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Search by name, email, or organization',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
