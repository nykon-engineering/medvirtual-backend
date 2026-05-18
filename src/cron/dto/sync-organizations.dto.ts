import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SyncOrganizationsDto {
  @ApiPropertyOptional({
    description:
      'Organization ID to sync. If omitted, all referred organizations are processed.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  organization_id?: string;
}
