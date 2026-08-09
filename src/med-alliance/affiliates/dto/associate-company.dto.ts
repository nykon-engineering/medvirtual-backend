import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssociateCompanyDto {
  @ApiProperty({
    description: 'UUID of the organization to associate with this affiliate',
  })
  @IsUUID()
  organization_id: string;
}
