import { Controller, Post, Body, UseGuards, HttpCode, Get, Param, Query, Patch, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { existsSync, unlinkSync } from 'fs';
import * as path from 'path';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto, BulkCreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { BulkUpdateInvoiceStatusDto } from './dto/bulk-update-invoice-status.dto';
import { UpdateInvoiceVersionDto } from './dto/update-invoice-version.dto';
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

  @Get('stats')
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'Get invoice statistics' })
  async getStats(@Query() query: ListInvoicesDto) {
    return await this.invoiceService.getStats(query);
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

  @Get(':id/pdf')
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'Generate and download invoice PDF' })
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.invoiceService.findOne(id);
    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    const filePath = await this.invoiceService.generateInvoicePdf(id);
    
    if (!filePath || !existsSync(filePath)) {
      throw new BadRequestException('Failed to generate PDF');
    }

    let ref = invoice.invoice_number
      ? invoice.reference?.replace(/[A-Z]{5}$/, invoice.invoice_number)
      : invoice.reference || invoice.id;
    let name = `${ref}.pdf`;

    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return res.download(filePath, name, (err) => {
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to unlink temp PDF:', e);
        }
      }
      if (err) {
        console.error('PDF download error:', err);
      }
    });
  }

  @Get(':id/audit-logs')
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'Fetch all audit logs of an invoice' })
  async findAuditLogs(@Param('id') id: string) {
    return await this.invoiceService.findAuditLogs(id);
  }

  @Patch(':id/status')
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'Update invoice status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceStatusDto,
    @CurrentUser() user: USER,
  ) {
    return await this.invoiceService.updateStatus(id, dto.status, user.id);
  }

  @Patch('bulk-status')
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'Bulk update invoice statuses' })
  async bulkUpdateStatus(
    @Body() dto: BulkUpdateInvoiceStatusDto,
    @CurrentUser() user: USER,
  ) {
    return await this.invoiceService.bulkUpdateStatus(dto.ids, dto.status, user.id);
  }

  @Post(':id/version')
  @Roles('system_admin', 'system_super_admin')
  @ApiOperation({ summary: 'Create a new version of an invoice' })
  async createVersion(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceVersionDto,
    @CurrentUser() user: USER,
  ) {
    return await this.invoiceService.createVersion(id, dto, user.id);
  }
}
