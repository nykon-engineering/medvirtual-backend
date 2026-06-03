import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class BillWebhookMetadataDto {
  @ApiPropertyOptional({
    description: 'Unique identifier for the event',
    example: '625947c4-8e6b-48f0-ae72-ea9c9375ec27',
  })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional({
    description: 'ID of the webhook subscription',
    example: 'f6d06930-e3e2-4509-be37-4dbda29efc6i',
  })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional({
    description: 'Bill.com organization ID',
    example: '00802DEVKGROHKDIY4zyx',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Type of the event',
    example: 'payment.updated',
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: 'Payload schema version', example: '1' })
  @IsOptional()
  @IsString()
  version?: string;
}

export class BillWebhookFundingAccountDto {
  @ApiPropertyOptional({
    description: 'Funding account ID',
    example: 'bac01123ABC456DEF789',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ description: 'Account type', example: 'BANK_ACCOUNT' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Account holder name',
    example: 'Noodle Soupsmith',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Masked account number',
    example: '************1111',
  })
  @IsOptional()
  @IsString()
  accountNumber?: string;
}

export class BillWebhookFundingDto {
  @ApiPropertyOptional({ description: 'Transaction amount', example: 228.99 })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Funding bank account details',
    type: BillWebhookFundingAccountDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillWebhookFundingAccountDto)
  fundingAccount?: BillWebhookFundingAccountDto;
}

export class BillWebhookDisbursementAccountDto {
  @ApiPropertyOptional({
    description: 'Disbursement account type',
    example: 'ACH',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Masked destination account number',
    example: '******333',
  })
  @IsOptional()
  @IsString()
  accountNumber?: string;
}

export class BillWebhookDisbursementDto {
  @ApiPropertyOptional({ description: 'Disbursement amount', example: 228.99 })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Expected arrival date (YYYY-MM-DD)',
    example: '2026-12-20',
  })
  @IsOptional()
  @IsString()
  arrivesByDate?: string;

  @ApiPropertyOptional({
    description: 'Destination account details',
    type: BillWebhookDisbursementAccountDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillWebhookDisbursementAccountDto)
  disbursementAccount?: BillWebhookDisbursementAccountDto;
}

export class BillWebhookVendorDto {
  @ApiPropertyOptional({
    description: 'Bill.com vendor ID',
    example: '00902BILKFECNEV2oji1',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({
    description: 'Vendor display name',
    example: 'Happy Music Supplies',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

export class BillWebhookPaymentDto {
  @ApiPropertyOptional({
    description: 'Bill.com payment ID',
    example: 'stp01VTFIWRGOUMAVl39',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({
    description: 'IDs of bills covered by this payment',
    example: ['00n02JZNIEYMNPY99iz9'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  billIds?: string[];

  @ApiPropertyOptional({
    description: 'Human-readable transaction number',
    example: '202602026',
  })
  @IsOptional()
  @IsString()
  transactionNumber?: string;

  @ApiPropertyOptional({ description: 'Payment status', example: 'PROCESSED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'ID of the user who created the payment',
    example: '00602NNWYXSZQYLTa41g',
  })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({
    description: 'ISO timestamp when the payment was created',
    example: '2026-12-16T23:56:52.127+00:00',
  })
  @IsOptional()
  @IsString()
  createdTime?: string;

  @ApiPropertyOptional({
    description: 'ISO timestamp of the last update',
    example: '2026-12-17T23:56:52.127+00:00',
  })
  @IsOptional()
  @IsString()
  updatedTime?: string;

  @ApiPropertyOptional({
    description: 'Date the payment was processed (YYYY-MM-DD)',
    example: '2026-12-17',
  })
  @IsOptional()
  @IsString()
  processDate?: string;

  @ApiPropertyOptional({
    description: 'Source funding account details',
    type: BillWebhookFundingDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillWebhookFundingDto)
  funding?: BillWebhookFundingDto;

  @ApiPropertyOptional({
    description: 'Disbursement destination details',
    type: BillWebhookDisbursementDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillWebhookDisbursementDto)
  disbursement?: BillWebhookDisbursementDto;

  @ApiPropertyOptional({
    description: 'Vendor associated with the payment',
    type: BillWebhookVendorDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillWebhookVendorDto)
  vendor?: BillWebhookVendorDto;

  @ApiPropertyOptional({ description: 'Billing type', example: 'BILL_AUTOPAY' })
  @IsOptional()
  @IsString()
  billingType?: string;
}

export class BillWebhookDto {
  @ApiPropertyOptional({
    description: 'Event metadata (subscription, org, type)',
    type: BillWebhookMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillWebhookMetadataDto)
  metadata?: BillWebhookMetadataDto;

  @ApiPropertyOptional({
    description: 'Payment object from Bill.com',
    type: BillWebhookPaymentDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillWebhookPaymentDto)
  payment?: BillWebhookPaymentDto;
}

/*

{
    "metadata": {
        "eventId": "625947c4-8e6b-48f0-ae72-ea9c9375ec27",
        "subscriptionId": "f6d06930-e3e2-4509-be37-4dbda29efc6i",
        "organizationId": "00802DEVKGROHKDIY4zyx",
        "eventType": "payment.updated",
        "version": "1"
    },
    "payment": {
        "id": "stp01VTFIWRGOUMAVl39",
        "billIds": [
             "00n02JZNIEYMNPY99iz9"
        ],
        "transactionNumber": "202602026",
        "status": "PROCESSED",
        "createdBy": "00602NNWYXSZQYLTa41g",
        "createdTime": "2026-12-16T23:56:52.127+00:00",
        "updatedTime": "2026-12-17T23:56:52.127+00:00",
        "processDate": "2026-12-17",
        "funding": {
            "amount": 228.99,
            "currency": "USD",
            "fundingAccount": {
                "id": "bac01123ABC456DEF789",
                "type": "BANK_ACCOUNT",
                "name": "Noodle Soupsmith",
                "accountNumber": "************1111"
            }
        },
        "disbursement": {
            "amount": 228.99,
            "currency": "USD",
            "arrivesByDate": "2026-12-20",
            "disbursementAccount": {
                "type": "ACH",
                "accountNumber": "******333"
            }
        },
        "vendor": {
            "id": "00902BILKFECNEV2oji1",
            "name": "Happy Music Supplies"
        },
        "billingType": "BILL_AUTOPAY"
    }
}
*/
