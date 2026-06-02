import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  HubspotEntityType,
  HubspotAuditAction,
  HubspotAuditSource,
} from '@prisma/client';

export class ListHubspotAuditLogsDto {
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

  @ApiPropertyOptional({ enum: HubspotEntityType })
  @IsOptional()
  @IsEnum(HubspotEntityType)
  entity_type?: HubspotEntityType;

  @ApiPropertyOptional({ enum: HubspotAuditAction })
  @IsOptional()
  @IsEnum(HubspotAuditAction)
  action?: HubspotAuditAction;

  @ApiPropertyOptional({ enum: HubspotAuditSource })
  @IsOptional()
  @IsEnum(HubspotAuditSource)
  source?: HubspotAuditSource;

  @ApiPropertyOptional({ description: 'true or false' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  success?: boolean;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Search by entity_id, actor_label or error_message',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
