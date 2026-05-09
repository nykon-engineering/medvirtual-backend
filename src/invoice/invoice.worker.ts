import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { HubstaffService } from '../hubstaff/hubstaff.service';
import { PusherService } from '../pusher/pusher.service';
import { InvoiceJobStatus, InvoiceStatus, InvoiceVersionStatus, InvoiceLineType, InvoiceLineCategory, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Processor('invoice')
@Injectable()
export class InvoiceWorker extends WorkerHost {
  private readonly logger = new Logger(InvoiceWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hubstaff: HubstaffService,
    private readonly pusher: PusherService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const payload = job.data;
    const { job_id, organization_id, billing_start_date, billing_end_date, created_by, is_prebill } = payload;

    try {
      // 1. Mark job as "processing"
      await this.prisma.invoiceJob.update({
        where: { id: job_id },
        data: { status: InvoiceJobStatus.processing },
      });

      await this.pusher.trigger(`user-${created_by}`, 'invoice.job.creation', {
        job_id,
        status: 'processing',
        timestamp: new Date().toISOString(),
      });

      // 2. Concurrency / Idempotency Check (Double Check)
      const existingInvoice = await this.prisma.invoice.findUnique({
        where: {
          uq_invoice_cycle: {
            organization_id,
            billing_start_date: new Date(billing_start_date),
            billing_end_date: new Date(billing_end_date),
          },
        },
      });

      if (existingInvoice) {
        this.logger.warn(`Invoice already exists for org ${organization_id} cycle ${billing_start_date} - ${billing_end_date}. Skipping.`);
        await this.completeJob(job_id, created_by, [existingInvoice.id]);
        return;
      }

      // 3. Fetch Organization & Configuration
      const org = await this.prisma.organization.findUnique({
        where: { id: organization_id },
        include: { invoiceConfiguration: true },
      });

      if (!org || !org.invoiceConfiguration || !org.invoiceConfiguration.hubstaff_id) {
        throw new Error('Organization not found or Hubstaff connection missing');
      }

      const hubstaffOrgId = org.invoiceConfiguration.hubstaff_id;

      // 4. Generate Invoice (Core Logic)
      const invoice = await this.generateInvoiceRecord(org, payload);

      // 5. Emit Completion
      await this.completeJob(job_id, created_by, [invoice.id]);

    } catch (error) {
      this.logger.error(`Job ${job_id} failed: ${error.message}`);
      await this.prisma.invoiceJob.update({
        where: { id: job_id },
        data: {
          status: InvoiceJobStatus.failed,
          error_message: error.message,
          failed_tasks: { increment: 1 },
        },
      });

      await this.pusher.trigger(`user-${created_by}`, 'invoice.job.creation', {
        job_id,
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async generateInvoiceRecord(org: any, payload: any) {
    const { 
      organization_id, 
      billing_start_date, 
      billing_end_date, 
      issue_date, 
      due_date, 
      public_due_date, 
      is_prebill, 
      created_by 
    } = payload;
    const hubstaffId = org.invoiceConfiguration.hubstaff_id;

    // Aggregate by user
    const userSummary = new Map<number, { tracked: number; overall: number }>();

    if (is_prebill) {
      // Pre-bill logic: Assume 8hrs per day for all project members
      const members = await this.hubstaff.getProjectMembers(hubstaffId);
      const startDate = new Date(billing_start_date);
      const endDate = new Date(billing_end_date);
      const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
      const secondsPerMember = days * 8 * 3600;

      members.forEach((member: any) => {
        userSummary.set(member.user_id, {
          tracked: secondsPerMember,
          overall: secondsPerMember,
        });
      });

      if (members.length === 0) {
        this.logger.warn(`No members found for Hubstaff project ${hubstaffId} during pre-bill for org ${organization_id}`);
      }
    } else {
      // Regular logic: Fetch Hubstaff activities
      const activities = await this.hubstaff.getHubstaffDailyActivityForInvoice({
        hubstaffId: Number(hubstaffId),
        start_date: billing_start_date,
        end_date: billing_end_date,
      });

      if (activities.length === 0) {
        this.logger.warn(`No activities found for org ${organization_id} in period ${billing_start_date} - ${billing_end_date}`);
      }

      activities.forEach((act: any) => {
        const current = userSummary.get(act.user_id) || { tracked: 0, overall: 0 };
        userSummary.set(act.user_id, {
          tracked: current.tracked + act.total_time_logged,
          overall: current.overall + act.overall,
        });
      });
    }

    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create Invoice Header
      const invoice = await tx.invoice.create({
        data: {
          organization_id,
          status: InvoiceStatus.draft,
          created_by,
          billing_start_date: new Date(billing_start_date),
          billing_end_date: new Date(billing_end_date),
        },
      });

      // 2. Create Invoice Version (Draft)
      const version = await tx.invoiceVersion.create({
        data: {
          invoice_id: invoice.id,
          version_number: 1,
          status: InvoiceVersionStatus.draft,
          currency: org.invoiceConfiguration.billing_currency || 'USD',
          billing_start_date: new Date(billing_start_date),
          billing_end_date: new Date(billing_end_date),
          issue_date: issue_date ? new Date(issue_date) : null,
          due_date: due_date ? new Date(due_date) : null,
          public_due_date: public_due_date ? new Date(public_due_date) : null,
          is_prebill: is_prebill || false, // Pre-bill flag from DTO
          created_by,
          subtotal: 0,
          total: 0,
        },
      });

      let subtotal = new Decimal(0);

      // 3. Create Line Items
      for (const [userId, stats] of userSummary.entries()) {
        const hours = new Decimal(stats.tracked).dividedBy(3600); // convert seconds to hours
        const hourlyRate = new Decimal(25); // Placeholder: Should fetch from Expert/Staff record
        const lineTotal = hours.mul(hourlyRate);

        await tx.invoiceLineItem.create({
          data: {
            invoice_version_id: version.id,
            worker_id: userId.toString(),
            type: InvoiceLineType.primary,
            category: InvoiceLineCategory.hourly_service,
            description: `Hourly services for Hubstaff User ${userId}`,
            effective_worked_hours: hours,
            total_hours_payable: hours,
            hourly_rate: hourlyRate,
            final_total: lineTotal,
            created_by,
          },
        });

        subtotal = subtotal.add(lineTotal);
      }

      // 4. Update Version Totals
      const finalVersion = await tx.invoiceVersion.update({
        where: { id: version.id },
        data: {
          subtotal,
          total: subtotal, // Tax handling can be added later
        },
      });

      // 5. Link Version to Invoice Header
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { current_version_id: version.id },
      });

      return invoice;
    });
  }

  private async completeJob(job_id: string, userId: string, invoiceIds: string[]) {
    await this.prisma.invoiceJob.update({
      where: { id: job_id },
      data: {
        status: InvoiceJobStatus.completed,
        completed_tasks: { increment: 1 },
        result: { invoice_ids: invoiceIds },
      },
    });

    await this.pusher.trigger(`user-${userId}`, 'invoice.job.creation', {
      job_id,
      status: 'completed',
      invoice_ids: invoiceIds,
      timestamp: new Date().toISOString(),
    });
  }
}
