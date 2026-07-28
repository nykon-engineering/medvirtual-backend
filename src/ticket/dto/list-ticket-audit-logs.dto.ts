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
import { TicketAuditSource } from '@prisma/client';
import {
  TICKET_AUDIT_ORIGINS,
  TicketAuditOrigin,
} from '../ticket-audit.service';

export class ListTicketAuditLogsDto {
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

  @ApiPropertyOptional({ description: 'Filter by a single ticket id' })
  @IsOptional()
  @IsString()
  ticket_id?: string;

  @ApiPropertyOptional({
    description:
      'Lifecycle event name, e.g. created, updated, status_changed, deleted, restored',
    example: 'deleted',
  })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({ enum: TicketAuditSource })
  @IsOptional()
  @IsEnum(TicketAuditSource)
  source?: TicketAuditSource;

  @ApiPropertyOptional({ description: 'Filter by the acting user id' })
  @IsOptional()
  @IsString()
  actor_user_id?: string;

  @ApiPropertyOptional({
    description: 'Where the ticket came from. Only meaningful for created events.',
    enum: Object.values(TICKET_AUDIT_ORIGINS),
    example: 'staff_bonus',
  })
  @IsOptional()
  @IsEnum(TICKET_AUDIT_ORIGINS)
  origin?: TicketAuditOrigin;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Search by ticket_id, actor_label or reason',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
