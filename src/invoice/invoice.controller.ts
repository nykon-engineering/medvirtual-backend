import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto, BulkCreateInvoiceDto } from './dto/create-invoice.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { USER } from '@prisma/client';

@ApiTags('Invoices')
@Controller('invoice')
@UseGuards(AuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post('create')
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(202)
  @ApiOperation({ summary: 'Create a single invoice asynchronously' })
  @ApiResponse({ status: 202, description: 'Invoice creation task queued' })
  async create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: USER) {
    return await this.invoiceService.createInvoice(dto, user.id);
  }

  @Post('bulk-create')
  @Roles('system_admin', 'system_super_admin')
  @HttpCode(202)
  @ApiOperation({ summary: 'Create multiple invoices asynchronously' })
  @ApiResponse({ status: 202, description: 'Bulk invoice creation tasks queued' })
  async createBulk(@Body() dto: BulkCreateInvoiceDto, @CurrentUser() user: USER) {
    return await this.invoiceService.createBulkInvoices(dto, user.id);
  }
}
