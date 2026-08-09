import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MedAllianceEntityType, MedAllianceAuditSource } from '@prisma/client';

export class ListMedAllianceAuditLogsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: MedAllianceEntityType })
  @IsOptional()
  @IsEnum(MedAllianceEntityType)
  entity_type?: MedAllianceEntityType;

  @ApiPropertyOptional({ description: 'Filter by event name (partial match)' })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({ enum: MedAllianceAuditSource })
  @IsOptional()
  @IsEnum(MedAllianceAuditSource)
  source?: MedAllianceAuditSource;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Search by entity_id, event or reason' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
