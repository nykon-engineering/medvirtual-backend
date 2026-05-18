import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { HubstaffService } from '../hubstaff/hubstaff.service';
import { PusherService } from '../pusher/pusher.service';
import { InvoiceJobStatus, InvoiceStatus, InvoiceVersionStatus, InvoiceLineType, InvoiceLineCategory, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { DateTime } from 'luxon';

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

  private generateReference(date: Date = new Date(), customSuffix?: string): string {
    const suffix = customSuffix || this.generateRandomString(5);
    const dateVal = DateTime.fromJSDate(date).toFormat("yyyyLLdd-hh-mm");
    return `${dateVal}-${suffix.toUpperCase()}`;
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name !== 'generate-invoice') {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

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

      // 2. Fetch Organization & Configuration
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

    // Fetch project members to get names for snapshots
    const members = await this.hubstaff.getProjectMembers(hubstaffId);

    const emailMap = new Map<number, string>();
    const memberMap = new Map<number, string>();
    members.forEach((m: any) => {
      if (m.user_id) {
        memberMap.set(m.user_id, m.name || m.user?.name || `Hubstaff User ${m.user_id}`);
        if (m.user?.email) {
          emailMap.set(m.user_id, m.user.email);
        }
      }
    });

    const emails = Array.from(emailMap.values());
    const names = members
      .map((m: any) => m.name || m.user?.name)
      .filter((name): name is string => !!name);

    // Fetch all candidates by email OR name, populated with their staff records
    const candidates = (emails.length > 0 || names.length > 0) ? await this.prisma.candidate.findMany({
      where: {
        OR: [
          {
            email: {
              in: emails,
              mode: 'insensitive',
            },
          },
          {
            name: {
              in: names,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        staff: true,
      },
    }) : [];

    // Aggregate by user
    const userSummary = new Map<number, { tracked: number; overall: number }>();

    if (is_prebill) {
      // Pre-bill logic: Assume 8hrs per day for all project members
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

        // Use sideloaded user name if available to populate/update memberMap
        if (act.user_name) {
          memberMap.set(act.user_id, act.user_name);
        }
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
          reference: this.generateReference(),
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

        // Find Candidate & Staff
        const email = emailMap.get(userId);
        const name = memberMap.get(userId);

        let candidate = email ? candidates.find(c => c.email.toLowerCase() === email.toLowerCase()) : null;
        if (!candidate && name) {
          candidate = candidates.find(
            c => c.name?.trim().toLowerCase() === name.trim().toLowerCase()
          ) || null;
        }

        const staff = candidate?.staff.find((s: any) => s.organization_id === organization_id) || candidate?.staff[0];

        let hourlyRate = new Decimal(25); // Default fallback

        if (staff && staff.salary) {
          const hoursPerMonth = Number(process.env.CANDIDATE_HOUR_PER_MONTH) || 176;
          hourlyRate = new Decimal(Number(staff.salary) / hoursPerMonth);
        } else if (candidate && candidate.hourly_pay_rate) {
          hourlyRate = new Decimal(Number(candidate.hourly_pay_rate));
        }

        const lineTotal = hours.mul(hourlyRate);

        const memberName = memberMap.get(userId) || `Hubstaff User ${userId}`;

        await tx.invoiceLineItem.create({
          data: {
            invoice_version_id: version.id,
            worker_id: userId.toString(),
            worker_name_snapshot: memberName,
            type: InvoiceLineType.primary,
            category: InvoiceLineCategory.hourly_service,
            description: `Hourly services for ${memberName}`,
            effective_worked_hours: hours,
            total_hours_worked: hours,
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
