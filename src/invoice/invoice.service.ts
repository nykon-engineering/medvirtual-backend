import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { CreateInvoiceDto, BulkCreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceJobStatus, InvoiceStatus, Prisma, TicketStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { isLocalMode } from '../common/bull.utils';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { UpdateInvoiceVersionDto } from './dto/update-invoice-version.dto';
import { Decimal } from '@prisma/client/runtime/library';

import { StripeService } from '../stripe/stripe.service';
import { chromium, Browser as PlaywrightBrowser } from 'playwright';
import { PDFDocument } from 'pdf-lib';
const pdf = require('pdf-parse');
import * as jwt from 'jsonwebtoken';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue('invoice') private readonly invoiceQueue: Queue | null,
    @Optional() @InjectQueue('invoice-prebill-reconciliation') private readonly prebillReconQueue: Queue | null,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
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
      where.status = {
        in: status.split(",") as unknown as InvoiceStatus[]
      };
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

    if (status === InvoiceStatus.voided || status === InvoiceStatus.cancelled) {
      // Release any BillingLedgerEntry rows that were applied to this invoice's
      // line items so they can be picked up by a future invoice.
      const versionId = invoice.current_version_id;
      if (versionId) {
        const lineItems = await this.prisma.invoiceLineItem.findMany({
          where: { invoice_version_id: versionId },
          select: { id: true },
        });
        const lineItemIds = lineItems.map((li) => li.id);

        if (lineItemIds.length > 0) {
          await this.prisma.billingLedgerEntry.updateMany({
            where: { applied_to_line_item_id: { in: lineItemIds } },
            data: { applied_to_line_item_id: null },
          });
        }
      }
    }


    // Placeholder for extra actions when publishing
    if (status === InvoiceStatus.published) {
      const fullInvoice = await this.findOne(id);
      if (!fullInvoice) {
        throw new BadRequestException('Invoice not found');
      }

      const config = fullInvoice.organization?.invoiceConfiguration;
      if (config?.auto_sync_to_stripe) {
        let stripeInvId = fullInvoice.stripe_invoice_id;
        const stripeCustId = config.stripe_customer_id;

        if (!stripeCustId) {
          throw new BadRequestException('Stripe customer ID is not configured for this organization');
        }

        if (!stripeInvId) {
          const createRes = await this.stripeService.createStripeInvoiceOnly({
            clientId: fullInvoice.organization_id,
            reference: fullInvoice.reference || '',
            dueDate: fullInvoice.currentVersion?.due_date || new Date(),
            isPrebill: fullInvoice.currentVersion?.is_prebill || false,
            periodStart: fullInvoice.currentVersion?.billing_start_date?.toISOString(),
            periodEnd: fullInvoice.currentVersion?.billing_end_date?.toISOString(),
            invoice: fullInvoice,
          });
          stripeInvId = createRes.invoice.id;
        }

        // Get fresh state of the invoice
        let freshInvoice = await this.findOne(id);
        if (!freshInvoice) {
          throw new BadRequestException('Invoice not found after creation on Stripe');
        }

        if (freshInvoice.stripe_status === 'invoice_created') {
          await this.stripeService.attachStripeInvoiceItems(freshInvoice, stripeCustId);
          freshInvoice = await this.findOne(id);
          if (!freshInvoice) {
            throw new BadRequestException('Invoice not found after attaching line items on Stripe');
          }
        }

        if (freshInvoice.stripe_status === 'all_line_items_added') {
          await this.stripeService.finalizeStripeInvoice(freshInvoice);
          freshInvoice = await this.findOne(id);
          if (!freshInvoice) {
            throw new BadRequestException('Invoice not found after finalizing on Stripe');
          }
        }

        if (freshInvoice.stripe_status === 'finalized') {
          await this.stripeService.verifyFinalizedStripeInvoice(freshInvoice);
        } else {
          throw new BadRequestException(
            `Stripe invoice must be finalized to publish. Current status: ${freshInvoice.stripe_status}`,
          );
        }
      }
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
        discountType: dto.discountType !== undefined ? dto.discountType : ((invoice.currentVersion as any)?.discountType || 'dollar'),
        discountValue: dto.discountValue !== undefined ? dto.discountValue : ((invoice.currentVersion as any)?.discountValue || 0),
      },
    });

    // Handle line items with parent mapping
    // We use a mapping to translate the IDs sent from the client to the new database IDs
    const idMapping = new Map<string, string>();
    const workerMapping = new Map<string, string>();

    // Pass 1: Create all parent line items first (where parent_line_item_id is null/undefined)
    for (const itemDto of dto.line_items) {
      if (!itemDto.parent_line_item_id) {
        const { id: clientSideId, parent_line_item_id, adjustment_sign, ...itemData } = itemDto;

        const createdItem = await this.prisma.invoiceLineItem.create({
          data: {
            ...itemData,
            invoice_version_id: newVersion.id,
            parent_line_item_id: null,
            created_by: userId,
          },
        });

        if (clientSideId) {
          idMapping.set(clientSideId, createdItem.id);
        }
        if (createdItem.worker_id) {
          workerMapping.set(createdItem.worker_id, createdItem.id);
        }
      }
    }

    // Pass 2: Create child line items, resolving parent_line_item_id to the new database IDs
    for (const itemDto of dto.line_items) {
      if (itemDto.parent_line_item_id) {
        const { id: clientSideId, parent_line_item_id, adjustment_sign, ...itemData } = itemDto;

        const resolvedParentId =
          idMapping.get(parent_line_item_id) ||
          workerMapping.get(parent_line_item_id) ||
          (itemDto.worker_id ? workerMapping.get(itemDto.worker_id) : undefined) ||
          parent_line_item_id;

        const createdItem = await this.prisma.invoiceLineItem.create({
          data: {
            ...itemData,
            invoice_version_id: newVersion.id,
            parent_line_item_id: resolvedParentId,
            created_by: userId,
          },
        });

        if (clientSideId) {
          idMapping.set(clientSideId, createdItem.id);
        }
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
        organization: {
          include: {
            invoiceConfiguration: true,
          },
        },
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
    if (isLocalMode(this.configService.get<string>('REDIS_BASE_KEY', ''))) {
      this.logger.warn('LOCAL mode — invoice generation job NOT enqueued.');
      return;
    }
    try {
      await this.invoiceQueue!.add('generate-invoice', message, {
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

  public async generateInvoicePdf(
    invoiceId: string,
    truncatePage1?: boolean,
  ): Promise<string> {
    let browser: PlaywrightBrowser | null = null;
    try {
      let user = await this.prisma.uSER.findFirst({
        where: {
          email: "pdf.generator@legalsoft.com",
        },
      });
      if (!user) {
        let baseUser = await this.prisma.uSER.findFirst({
          where: {
            email: "admin@medvirtual.ai",
          },
        });
        if (!baseUser) {
          baseUser = await this.prisma.uSER.findFirst({
            where: {
              role: "system_super_admin",
            },
          });
        }
        if (baseUser) {
          user = await this.prisma.uSER.create({
            data: {
              email: "pdf.generator@legalsoft.com",
              first_name: "PDF",
              last_name: "Generator",
              role: baseUser.role,
              status: "active",
              verified: true,
              password: baseUser.password,
              phone: baseUser.phone || "",
              avatar: baseUser.avatar || "",
              job_title: "PDF Generator Service",
              organization_name: baseUser.organization_name || "",
              workos_id: baseUser.workos_id || "",
              authentication_method: baseUser.authentication_method || "OwnSign",
            },
          });
        }
      }

      let token: string | null = null;
      if (user) {
        const jwtToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', {
          expiresIn: '8h',
        });
        token = jwtToken;
        await this.prisma.session.updateMany({
          where: { userId: user.id },
          data: { isRevoked: true },
        });
        await this.prisma.session.create({
          data: {
            userId: user.id,
            token: jwtToken,
            expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
          },
        });
      }

      const invoice = await this.findOne(invoiceId);
      if (!invoice) throw new BadRequestException("Invoice not found");

      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox"],
      });
      const context = await browser.newContext();

      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || process.env.FRONTEND_URL || 'https://staging.medvirtual.ai';

      if (token) {
        await context.addCookies([
          {
            name: 'auth-token',
            value: token,
            url: frontendUrl,
          }
        ]);
      }

      const page = await context.newPage();

      // page.on('request', req => this.logger.log(`[Playwright Request] ${req.url()} (${req.method()})`));
      // page.on('response', res => this.logger.log(`[Playwright Response] ${res.url()} -> Status ${res.status()}`));
      // page.on('requestfailed', req => this.logger.log(`[Playwright Request Failed] ${req.url()} - Error: ${req.failure()?.errorText}`));

      let url = `${frontendUrl}/templates/invoices?invoiceId=${invoiceId}`;
      if (token) {
        url += `&token=${token}`;
      }

      await page.goto(url, { waitUntil: "domcontentloaded" });

      await page.waitForResponse(
        (response) =>
          response.url().includes(`invoice/${invoiceId}`) &&
          response.status() === 200,
        { timeout: 40000 },
      );

      const divSelector = ".invoice-template";

      await page.addStyleTag({
        content: `
          @page {
            size: A3 landscape;
            margin: 0;
          }

          @media print {
            html, body {
              width: 100%;
              height: auto !important;
              overflow: visible !important;
            }
            .invoice-template {
              page-break-inside: avoid;
              page-break-after: always;
              width: 100%;
              transform-origin: top left;
            }
          }
        `,
      });

      await page.waitForSelector(divSelector);
      const divHandle = await page.$(divSelector);

      const localFilePath = path.join(process.cwd(), 'generated-files');
      if (!existsSync(localFilePath)) {
        mkdirSync(localFilePath, { recursive: true });
      }

      if (divHandle) {
        const fullHeight = await page.evaluate(() => {
          return Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
          );
        });
        await page.setViewportSize({ width: 1920, height: fullHeight });

        const ref = invoice?.reference || invoiceId;
        const filePath = path.join(localFilePath, `${ref}.pdf`);
        const payload: any = {
          path: filePath,
          format: "A3",
          margin: {
            top: "0",
            right: "0",
            bottom: "0",
            left: "0",
          },
          scale: 1,
          landscape: true,
          printBackground: true,
          preferCSSPageSize: true,
        };

        if (truncatePage1) {
          payload.pageRanges = '2-';
        }

        await page.pdf(payload);
        this.logger.log(`PDF saved for invoice ${invoiceId}`);
        // await this.checkEmptyFirstPage(filePath);
        return filePath;
      }
      return "";
    } catch (error) {
      this.logger.error(`Error generating invoice PDF: ${error.message}`, error.stack);
      return "";
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          this.logger.error("Error closing browser:", closeError);
        }
      }
    }
  }

  public async checkEmptyFirstPage(filePath: string) {
    try {
      const existingPdfBytes = readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes);

      const initialPageCount = pdfDoc.getPageCount();
      const pagesToRemove: number[] = [];

      for (let i = 0; i < initialPageCount; i++) {
        try {
          const newPdfDoc = await PDFDocument.create();
          const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
          newPdfDoc.addPage(copiedPage);
          const singlePagePdfBytes = await newPdfDoc.save({
            useObjectStreams: false,
          });
          const pdfContent = await (pdf as any)(Buffer.from(singlePagePdfBytes));
          const pageText = pdfContent.text.trim();

          if (pageText.length === 0) {
            this.logger.log(`Page ${i + 1} is likely blank. Marking for removal.`);
            pagesToRemove.push(i);
          } else {
            this.logger.log(`Page ${i + 1} contains content.`);
          }
        } catch (error) {
          this.logger.error(`Error checking page ${i + 1}: ${error.message}`);
          pagesToRemove.push(i);
        }
      }

      for (let i = pagesToRemove.length - 1; i >= 0; i--) {
        pdfDoc.removePage(pagesToRemove[i]);
      }

      const modifiedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
      writeFileSync(filePath, modifiedPdfBytes);
      this.logger.log(`PDF processed and saved to ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to process first page check for ${filePath}: ${error.message}`);
    }
  }

  async findAuditLogs(invoiceId: string) {
    return await this.prisma.invoiceAuditLog.findMany({
      where: { invoice_id: invoiceId },
      include: {
        actor: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrgBillingLedger(
    organizationId: string,
    opts: {
      status?: 'pending' | 'applied';
      workerId?: string;
      page: number;
      limit: number;
    },
  ) {
    const { status, workerId, page, limit } = opts;
    const skip = (page - 1) * limit;

    const where: Prisma.BillingLedgerEntryWhereInput = {
      organization_id: organizationId,
      ...(workerId ? { worker_id: workerId } : {}),
      ...(status === 'pending'
        ? { applied_to_line_item_id: null }
        : status === 'applied'
          ? { applied_to_line_item_id: { not: null } }
          : {}),
    };

    const lineItemSelect = {
      id: true,
      worker_id: true,
      worker_name_snapshot: true,
      type: true,
      category: true,
      description: true,
      final_total: true,
      effective_worked_hours: true,
      invoiceVersion: {
        select: {
          id: true,
          billing_start_date: true,
          billing_end_date: true,
          is_prebill: true,
          invoice: {
            select: {
              id: true,
              reference: true,
              invoice_number: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
    };

    const [entries, total] = await Promise.all([
      this.prisma.billingLedgerEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reconciliation: {
            select: {
              id: true,
              worker_id: true,
              estimated_amount: true,
              actual_amount: true,
              delta_amount: true,
              status: true,
              createdAt: true,
              completedAt: true,
            },
          },
          sourceLineItem: {
            select: lineItemSelect,
          },
          appliedLineItem: {
            select: lineItemSelect,
          },
        },
      }),
      this.prisma.billingLedgerEntry.count({ where }),
    ]);

    return {
      data: entries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }



  /**
   * Manually retrigger the prebill reconciliation job for a specific invoice.
   * Validates that the invoice exists, is a prebill, and has been paid,
   * then enqueues the job for immediate execution (delay = 0).
   */
  async triggerPrebillReconciliation(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        currentVersion: {
          select: { is_prebill: true, billing_end_date: true, billing_start_date: true },
        },
      },
    });

    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    if (!invoice.currentVersion?.is_prebill) {
      throw new BadRequestException('Invoice is not a pre-billed invoice');
    }

    if (invoice.status !== 'paid') {
      throw new BadRequestException(`Invoice must be paid before reconciliation can run (current status: ${invoice.status})`);
    }

    const billingStartDate = invoice.currentVersion.billing_start_date ?? invoice.billing_start_date;
    const billingEndDate = invoice.currentVersion.billing_end_date ?? invoice.billing_end_date;

    if (!billingStartDate || !billingEndDate) {
      throw new BadRequestException('Invoice is missing billing period dates');
    }

    const jobId = `prebill-recon-${invoiceId}`;

    // Remove any stale delayed job so the new one runs immediately
    const existing = await this.prebillReconQueue!.getJob(jobId);
    if (existing) {
      try { await existing.remove(); } catch { /* already processed or gone */ }
    }

    await this.prebillReconQueue!.add(
      'reconcile-prebill-invoice',
      {
        invoiceId,
        organizationId: invoice.organization_id,
        billingStartDate: billingStartDate.toISOString(),
        billingEndDate: billingEndDate.toISOString(),
      },
      {
        jobId,
        removeOnComplete: true,
        removeOnFail: false,
        // delay: 0 — run immediately
      },
    );

    this.logger.log(`Manually triggered prebill reconciliation for invoice ${invoiceId}`);

    return { status: 'queued', invoiceId };
  }
}

