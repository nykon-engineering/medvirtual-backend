import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { CreateInvoiceDto, BulkCreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceJobStatus, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { ListInvoicesDto } from './dto/list-invoices.dto';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('invoice') private readonly invoiceQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async createInvoice(dto: CreateInvoiceDto, userId: string) {
    // 1. Idempotency Check: Prevent duplicate jobs within 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60000);
    const recentJobs = await this.prisma.invoiceJob.findMany({
      where: {
        createdAt: { gte: sixtySecondsAgo },
      },
    });

    const existingJob = recentJobs.find((job) => {
      const payload = job.payload as any;
      return (
        payload &&
        payload.billing_start_date === dto.billing_start_date &&
        payload.billing_end_date === dto.billing_end_date &&
        (payload.organization_id === dto.organization_id ||
          (payload.organization_ids && payload.organization_ids.includes(dto.organization_id)))
      );
    });

    if (existingJob) {
      return {
        status: 'skipped',
        message: 'A similar generation job was recently started. Please wait a moment before trying again.',
        job_id: existingJob.id,
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

    // 1. Idempotency Check: Filter out organizations with a job started in the last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60000);
    const recentJobs = await this.prisma.invoiceJob.findMany({
      where: {
        createdAt: { gte: sixtySecondsAgo },
      },
    });

    const activeOrgIds = new Set<string>();
    recentJobs.forEach((job) => {
      const payload = job.payload as any;
      if (
        payload &&
        payload.billing_start_date === dates.billing_start_date &&
        payload.billing_end_date === dates.billing_end_date
      ) {
        if (payload.organization_id) activeOrgIds.add(payload.organization_id);
        if (payload.organization_ids) {
          payload.organization_ids.forEach((id: string) => activeOrgIds.add(id));
        }
      }
    });

    const filteredOrgIds = organization_ids.filter((id) => !activeOrgIds.has(id));

    if (filteredOrgIds.length === 0) {
      return {
        status: 'skipped',
        message: 'Recent generation jobs exist for all selected organizations. Please wait a moment.',
      };
    }

    // 2. Create a parent Job Record
    const job = await this.prisma.invoiceJob.create({
      data: {
        status: InvoiceJobStatus.queued,
        total_tasks: filteredOrgIds.length,
        payload: { ...dto, organization_ids: filteredOrgIds } as any,
      },
    });

    // 3. Emit messages for each organization
    const promises = filteredOrgIds.map((orgId) =>
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
      total_tasks: filteredOrgIds.length,
      skipped_count: organization_ids.length - filteredOrgIds.length,
    };
  }

  async findAll(query: ListInvoicesDto) {
    const { status, search } = query;
    const where: Prisma.InvoiceWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { invoice_number: { contains: search, mode: 'insensitive' } },
        { organization: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return await this.prisma.invoice.findMany({
      where,
      include: {
        currentVersion: {
          include: {
            line_items: true,
          },
        },
        organization: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        currentVersion: {
          include: {
            line_items: {
              orderBy: { sort_order: 'asc' },
            },
          },
        },
        organization: true,
        creator: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
    });
  }

  async findVersions(invoiceId: string) {
    return await this.prisma.invoiceVersion.findMany({
      where: { invoice_id: invoiceId },
      include: {
        creator: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
      orderBy: { version_number: 'desc' },
    });
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
