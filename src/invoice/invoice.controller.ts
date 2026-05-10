import { Controller, Post, Body, UseGuards, HttpCode, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto, BulkCreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
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

  @Get()
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'Fetch all invoices with their current versions and optional filters' })
  async findAll(@Query() query: ListInvoicesDto) {
    return await this.invoiceService.findAll(query);
  }

  @Get(':id')
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'Fetch a single invoice by ID' })
  async findOne(@Param('id') id: string) {
    return await this.invoiceService.findOne(id);
  }

  @Get(':id/versions')
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'Fetch all versions of an invoice' })
  async findVersions(@Param('id') id: string) {
    return await this.invoiceService.findVersions(id);
  }
}
