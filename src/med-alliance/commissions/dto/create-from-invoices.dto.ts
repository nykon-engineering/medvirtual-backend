import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class CreateFromInvoicesDto {
  @ApiProperty({
    type: [String],
    description: 'HubspotInvoiceSnapshot IDs to create commissions for',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  invoice_ids: string[];
}
