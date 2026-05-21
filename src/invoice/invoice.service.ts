import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { CreateInvoiceDto, BulkCreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceJobStatus, InvoiceStatus, Prisma, TicketStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { UpdateInvoiceVersionDto } from './dto/update-invoice-version.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('invoice') private readonly invoiceQueue: Queue,
    private readonly configService: ConfigService,
  ) { }

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
    const { status, search, organizationIds, billingMode } = query;
    const where: Prisma.InvoiceWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (organizationIds && organizationIds.length > 0) {
      where.organization_id = { in: organizationIds };
    }

    if (billingMode) {
      where.currentVersion = {
        is_prebill: billingMode === 'prebill',
      };
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

  async getStats(query: ListInvoicesDto) {
    const { search, organizationIds, billingMode } = query;
    const where: Prisma.InvoiceWhereInput = {};

    if (organizationIds && organizationIds.length > 0) {
      where.organization_id = { in: organizationIds };
    }

    if (billingMode) {
      where.currentVersion = {
        is_prebill: billingMode === 'prebill',
      };
    }

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { invoice_number: { contains: search, mode: 'insensitive' } },
        { organization: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Get counts per status
    const counts = await this.prisma.invoice.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    // Get total revenue (paid + partially_paid)
    const revenueInvoices = await this.prisma.invoice.findMany({
      where: {
        ...where,
        status: { in: [InvoiceStatus.paid, InvoiceStatus.partially_paid] },
      },
      select: {
        currentVersion: {
          select: {
            total: true,
          },
        },
      },
    });

    const totalRevenue = revenueInvoices.reduce((sum, inv) => {
      const val = inv.currentVersion?.total || 0;
      return sum.add(new Decimal(val.toString()));
    }, new Decimal(0));

    // Format counts into a nice object
    const statusCounts = Object.values(InvoiceStatus).reduce((acc, status) => {
      const match = counts.find((c) => c.status === status);
      acc[status] = match ? match._count.id : 0;
      return acc;
    }, {} as Record<InvoiceStatus, number>);

    return {
      statusCounts,
      totalRevenue: totalRevenue.toNumber(),
    };
  }

  async updateStatus(id: string, status: InvoiceStatus, userId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    const oldStatus = invoice.status;
    const dataToUpdate: Prisma.InvoiceUncheckedUpdateInput = {
      status,
    };

    // Generate invoice number on approval if not already set
    if (status === InvoiceStatus.approved && !invoice.invoice_number) {
      const invoiceNumber = await this.generateNextInvoiceNumber();
      dataToUpdate.invoice_number = invoiceNumber;

      // Replace the 5 random characters at the end of the reference with the invoice number
      if (invoice.reference && invoice.reference.length > 5) {
        const baseRef = invoice.reference.substring(0, invoice.reference.length - 5);
        dataToUpdate.reference = `${baseRef}${invoiceNumber}`;
      }
    }

    if (status === InvoiceStatus.voided) {
      dataToUpdate.voided_by = userId;
      dataToUpdate.voidedAt = new Date();
    }

    // Placeholder for extra actions when publishing
    if (status === InvoiceStatus.published) {
      // TODO: Add logic for publishing (e.g., generate final invoice number, notify client)
    }

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id },
      data: dataToUpdate,
      include: {
        currentVersion: true,
        organization: true,
      },
    });

    // If approved, close any associated tickets for bonus line items
    if (status === InvoiceStatus.approved && updatedInvoice.current_version_id) {
      const lineItems = await this.prisma.invoiceLineItem.findMany({
        where: {
          invoice_version_id: updatedInvoice.current_version_id,
          ticket_id: { not: null },
        },
        select: {
          ticket_id: true,
        },
      });

      const ticketIds = lineItems
        .map((item) => item.ticket_id)
        .filter((tId): tId is string => !!tId);

      if (ticketIds.length > 0) {
        await this.prisma.ticket.updateMany({
          where: {
            id: { in: ticketIds },
          },
          data: {
            status: TicketStatus.closed,
          },
        });
      }
    }

    // Create Audit Log
    await this.prisma.invoiceAuditLog.create({
      data: {
        invoice_id: id,
        actor_id: userId,
        event: 'status_updated',
        old_value: { status: oldStatus } as any,
        new_value: { ...dataToUpdate } as any,
      },
    });

    return updatedInvoice;
  }

  private async generateNextInvoiceNumber(): Promise<string> {
    try {
      const result = await this.prisma.$queryRawUnsafe<{ nextval: bigint }[]>(
        `SELECT nextval('invoice_number_seq')`,
      );
      return result[0].nextval.toString().padStart(5, '0');
    } catch (error) {
      // If sequence doesn't exist, create it and retry
      if (error.message.includes('does not exist')) {
        await this.prisma.$executeRawUnsafe(
          `CREATE SEQUENCE invoice_number_seq START 1`,
        );
        const result = await this.prisma.$queryRawUnsafe<{ nextval: bigint }[]>(
          `SELECT nextval('invoice_number_seq')`,
        );
        return result[0].nextval.toString().padStart(5, '0');
      }
      throw error;
    }
  }

  async bulkUpdateStatus(ids: string[], status: InvoiceStatus, userId: string) {
    const results = await Promise.all(
      ids.map((id) =>
        this.updateStatus(id, status, userId)
          .then((inv) => ({ id, status: 'success', invoice: inv }))
          .catch((err) => ({ id, status: 'error', message: err.message })),
      ),
    );

    const success_count = results.filter((r) => r.status === 'success').length;

    return {
      total: ids.length,
      success_count,
      failed_count: ids.length - success_count,
      results,
    };
  }

  async createVersion(id: string, dto: UpdateInvoiceVersionDto, userId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        currentVersion: true,
      },
    });

    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    // Get the latest version number
    const latestVersion = await this.prisma.invoiceVersion.findFirst({
      where: { invoice_id: id },
      orderBy: { version_number: 'desc' },
    });

    const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

    // Create the new version
    const newVersion = await this.prisma.invoiceVersion.create({
      data: {
        invoice_id: id,
        version_number: nextVersionNumber,
        status: invoice.currentVersion?.status || 'draft',
        currency: dto.currency || invoice.currentVersion?.currency || 'USD',
        subtotal: dto.subtotal,
        tax_total: dto.tax_total,
        total: dto.total,
        notes: dto.notes,
        created_by: userId,
        // Inherit dates from current version if not provided
        issue_date: invoice.currentVersion?.issue_date,
        due_date: invoice.currentVersion?.due_date,
        public_due_date: invoice.currentVersion?.public_due_date,
        billing_start_date: invoice.currentVersion?.billing_start_date,
        billing_end_date: invoice.currentVersion?.billing_end_date,
        is_prebill: invoice.currentVersion?.is_prebill || false,
      },
    });

    // Handle line items with parent mapping
    // We use a mapping to translate the IDs sent from the client to the new database IDs
    const idMapping = new Map<string, string>();

    for (const itemDto of dto.line_items) {
      const { id: clientSideId, parent_line_item_id, ...itemData } = itemDto;

      const createdItem = await this.prisma.invoiceLineItem.create({
        data: {
          ...itemData,
          invoice_version_id: newVersion.id,
          parent_line_item_id,
          created_by: userId,
        },
      });

      // Map the client-side ID to the new database ID for potential children
      if (clientSideId) {
        idMapping.set(clientSideId, createdItem.id);
      }
    }

    // Update the invoice to point to the new version
    const updatedInvoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        current_version_id: newVersion.id,
      },
      include: {
        currentVersion: {
          include: {
            line_items: true,
          },
        },
        organization: true,
      },
    });

    // Audit Log
    await this.prisma.invoiceAuditLog.create({
      data: {
        invoice_id: id,
        invoice_version_id: newVersion.id,
        actor_id: userId,
        event: 'version_updated',
        new_value: { version_number: nextVersionNumber } as any,
      },
    });

    return updatedInvoice;
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
