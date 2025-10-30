import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Priority } from '@prisma/client';

export class UpdateTicketDto {
  @ApiPropertyOptional({ description: 'Ticket title', type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Ticket description', type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ description: 'Ticket priority', enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ description: 'Ticket type (frontend value)', type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ description: 'Organization (client) ID to associate', type: String })
  @IsOptional()
  @IsUUID()
  client_id?: string;

  @ApiPropertyOptional({ description: 'Assigned user ID', type: String })
  @IsOptional()
  @IsUUID()
  assigned_user_id?: string;
}


