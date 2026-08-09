import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteTicketDto {
  @ApiPropertyOptional({
    description: 'Why the ticket is being deleted. Recorded in the audit log.',
    example: 'Duplicate of TICKET-123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
