import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssociationPreviewQueryDto {
  @ApiProperty({
    description: 'UUID of the organization to preview association for',
  })
  @IsUUID()
  organization_id: string;
}
