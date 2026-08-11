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
import { OfferPanelAuditSource } from '@prisma/client';
import {
  OFFER_PANEL_AUDIT_ORIGINS,
  OfferPanelAuditOrigin,
} from '../offer-panels-audit.service';

export class ListOfferPanelAuditLogsDto {
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

  @ApiPropertyOptional({ description: 'Filter by a single offer panel id' })
  @IsOptional()
  @IsString()
  offer_panel_id?: string;

  @ApiPropertyOptional({
    description:
      'Lifecycle event name, e.g. created, viewed, updated, candidate_removed, accepted, declined, deleted, resent',
    example: 'accepted',
  })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({ enum: OfferPanelAuditSource })
  @IsOptional()
  @IsEnum(OfferPanelAuditSource)
  source?: OfferPanelAuditSource;

  @ApiPropertyOptional({ description: 'Filter by the acting user id' })
  @IsOptional()
  @IsString()
  actor_user_id?: string;

  @ApiPropertyOptional({
    description: 'Which surface the action came from.',
    enum: Object.values(OFFER_PANEL_AUDIT_ORIGINS),
    example: 'public_token',
  })
  @IsOptional()
  @IsEnum(OFFER_PANEL_AUDIT_ORIGINS)
  origin?: OfferPanelAuditOrigin;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Search by offer_panel_id, actor_label or reason',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
