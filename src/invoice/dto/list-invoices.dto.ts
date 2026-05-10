import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsUUID, IsArray } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';
import { Transform } from 'class-transformer';

export class ListInvoicesDto {
  @ApiProperty({ enum: InvoiceStatus, required: false })
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @ApiProperty({ required: false, description: 'Search by reference, invoice number, or organization name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsUUID(undefined, { each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  organizationIds?: string[];

  @ApiProperty({ enum: ['arrears', 'prebill'], required: false })
  @IsEnum(['arrears', 'prebill'])
  @IsOptional()
  billingMode?: 'arrears' | 'prebill';
}
