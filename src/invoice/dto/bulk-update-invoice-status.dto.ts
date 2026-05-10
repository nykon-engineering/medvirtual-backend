import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsArray, IsUUID } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class BulkUpdateInvoiceStatusDto {
  @ApiProperty({ type: [String], example: ['uuid1', 'uuid2'] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids: string[];

  @ApiProperty({ enum: InvoiceStatus })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;
}
