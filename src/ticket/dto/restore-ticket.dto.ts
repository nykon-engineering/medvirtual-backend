import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RestoreTicketDto {
  @ApiPropertyOptional({
    description: 'Why the ticket is being restored. Recorded in the audit log.',
    example: 'Deleted by mistake',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
