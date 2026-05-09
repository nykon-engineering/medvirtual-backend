import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { CreateInvoiceDto, BulkCreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceJobStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('invoice') private readonly invoiceQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async createInvoice(dto: CreateInvoiceDto, userId: string) {
    // 1. Idempotency Check: Check if invoice already exists for this cycle
    const existingInvoice = await this.prisma.invoice.findUnique({
      where: {
        uq_invoice_cycle: {
          organization_id: dto.organization_id,
          billing_start_date: new Date(dto.billing_start_date),
          billing_end_date: new Date(dto.billing_end_date),
        },
      },
    });

    if (existingInvoice) {
      return {
        status: 'skipped',
        message: 'Invoice already exists for this cycle',
        invoice_id: existingInvoice.id,
      };
    }

    // 2. Create Job Record
    const job = await this.prisma.invoiceJob.create({
      data: {
        status: InvoiceJobStatus.queued,
        total_tasks: 1,
        payload: dto as any,
      },
    });

    // 3. Send to SQS
    await this.sendToQueue({
      job_id: job.id,
      organization_id: dto.organization_id,
      billing_start_date: dto.billing_start_date,
      billing_end_date: dto.billing_end_date,
      issue_date: dto.issue_date || new Date().toISOString(),
      due_date: dto.due_date || new Date().toISOString(),
      public_due_date: dto.public_due_date || dto.due_date || new Date().toISOString(),
      is_prebill: dto.is_prebill || false,
      created_by: userId,
      idempotency_key: uuidv4(),
    });

    return {
      job_id: job.id,
      status: 'queued',
    };
  }

  async createBulkInvoices(dto: BulkCreateInvoiceDto, userId: string) {
    const { organization_ids, ...dates } = dto;

    // 1. Create a parent Job Record
    const job = await this.prisma.invoiceJob.create({
      data: {
        status: InvoiceJobStatus.queued,
        total_tasks: organization_ids.length,
        payload: dto as any,
      },
    });

    // 2. Emit messages for each organization
    // Option A: Split into multiple SQS messages
    const promises = organization_ids.map((orgId) =>
      this.sendToQueue({
        job_id: job.id,
        organization_id: orgId,
        billing_start_date: dates.billing_start_date,
        billing_end_date: dates.billing_end_date,
        issue_date: dates.issue_date || new Date().toISOString(),
        due_date: dates.due_date || new Date().toISOString(),
        public_due_date: dates.public_due_date || dates.due_date || new Date().toISOString(),
        is_prebill: dates.is_prebill || false,
        created_by: userId,
        idempotency_key: uuidv4(),
      }),
    );

    await Promise.all(promises);

    return {
      job_id: job.id,
      status: 'queued',
      total_tasks: organization_ids.length,
    };
  }

  private async sendToQueue(message: any) {
    try {
      await this.invoiceQueue.add('generate-invoice', message, {
        jobId: message.idempotency_key, // Use idempotency key as job ID to prevent duplicates
        removeOnComplete: true,
        removeOnFail: false,
      });
      this.logger.log(`Sent invoice task to BullMQ for job ${message.job_id} / org ${message.organization_id}`);
    } catch (error) {
      this.logger.error(`Failed to send message to BullMQ: ${error.message}`);
      throw error;
    }
  }
}
