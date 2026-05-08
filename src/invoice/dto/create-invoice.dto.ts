import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceDto {
  @ApiProperty({ example: 'uuid-of-organization' })
  @IsUUID()
  organization_id: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  billing_start_date: string;

  @ApiProperty({ example: '2024-01-31' })
  @IsDateString()
  billing_end_date: string;

  @ApiProperty({ example: '2024-02-01', required: false })
  @IsDateString()
  @IsOptional()
  issue_date?: string;

  @ApiProperty({ example: '2024-02-15', required: false })
  @IsDateString()
  @IsOptional()
  due_date?: string;

  @ApiProperty({ example: '2024-02-15', required: false })
  @IsDateString()
  @IsOptional()
  public_due_date?: string;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  is_prebill?: boolean;
}

export class BulkCreateInvoiceDto {
  @ApiProperty({ type: [String], example: ['uuid1', 'uuid2'] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  organization_ids: string[];

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  billing_start_date: string;

  @ApiProperty({ example: '2024-01-31' })
  @IsDateString()
  billing_end_date: string;

  @ApiProperty({ example: '2024-02-01', required: false })
  @IsDateString()
  @IsOptional()
  issue_date?: string;

  @ApiProperty({ example: '2024-02-15', required: false })
  @IsDateString()
  @IsOptional()
  due_date?: string;

  @ApiProperty({ example: '2024-02-15', required: false })
  @IsDateString()
  @IsOptional()
  public_due_date?: string;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  is_prebill?: boolean;
}
