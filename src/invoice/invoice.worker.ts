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

  private getWorkdaysCount(startDate: Date, endDate: Date): number {
    let count = 0;
    let curDate = DateTime.fromJSDate(startDate).startOf('day');
    const lastDate = DateTime.fromJSDate(endDate).startOf('day');
    while (curDate.toMillis() <= lastDate.toMillis()) {
      const dayOfWeek = curDate.weekday; // 1 = Monday, 7 = Sunday in Luxon
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++;
      }
      curDate = curDate.plus({ days: 1 });
    }
    return count;
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

    const memberMap = new Map<number, string>();
    members.forEach((m: any) => {
      if (m.user_id) {
        memberMap.set(m.user_id, m.name || m.user?.name || `Hubstaff User ${m.user_id}`);
      }
    });

    const hubstaffUserIds = members
      .map((m: any) => m.user_id ? String(m.user_id) : null)
      .filter((id): id is string => !!id);

    const startOfPeriod = DateTime.fromISO(billing_start_date).startOf('day').toJSDate();
    const endOfPeriod = DateTime.fromISO(billing_end_date).endOf('day').toJSDate();

    // Fetch all staff by candidate's hubstaff_id, matching this organization
    const staffRecords = (hubstaffUserIds.length > 0) ? await this.prisma.staff.findMany({
      where: {
        candidate: {
          hubstaff_id: {
            in: hubstaffUserIds,
          },
        },
        OR: [
          { organization_id: organization_id },
          ...(org.hubspot_id ? [{ hubspot_organization_id: org.hubspot_id }] : []),
        ],
      },
      include: {
        candidate: true,
        tickets: {
          where: {
            type: {
              equals: 'bonus',
              mode: 'insensitive',
            },
            org_id: organization_id,
            status: 'resolved',
            createdAt: {
              gte: startOfPeriod,
              lte: endOfPeriod,
            },
          },
        },
      },
    }) : [];

    // Aggregate by user
    const userSummary = new Map<number, { tracked: number; overall: number }>();
    let activities: any[] = [];

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
      activities = await this.hubstaff.getHubstaffDailyActivityForInvoice({
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

    // Now collect all unique user IDs for fetching PTOs
    const uniqueUserIdsForPto = Array.from(new Set([
      ...hubstaffUserIds,
      ...activities.map((act: any) => String(act.user_id))
    ]));

    // Fetch and filter approved PTOs
    const startDateISO = DateTime.fromISO(billing_start_date).startOf('day').toISO() || undefined;
    const endDateISO = DateTime.fromISO(billing_end_date).plus({ days: 1 }).startOf('day').toISO() || undefined;

    const ptoRequests = (uniqueUserIdsForPto.length > 0)
      ? await this.hubstaff.getTimeOffRequests(uniqueUserIdsForPto, startDateISO, endDateISO)
      : [];

    const approvedPtos = ptoRequests.filter(pto => pto.status === 'approved');

    // Define the list of all days in the billing period
    const startJSDate = new Date(billing_start_date);
    const endJSDate = new Date(billing_end_date);
    let curDate = DateTime.fromJSDate(startJSDate).startOf('day');
    const lastDate = DateTime.fromJSDate(endJSDate).startOf('day');
    const allDaysList: DateTime[] = [];
    while (curDate.toMillis() <= lastDate.toMillis()) {
      allDaysList.push(curDate);
      curDate = curDate.plus({ days: 1 });
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
        // Find Staff & Candidate
        const staff = staffRecords.find(s => s.candidate?.hubstaff_id === String(userId)) || null;
        const candidate = staff?.candidate || null;

        let isFullTime = false;
        if (staff) {
          const deploymentType = (staff.hubspot_deployment_type || '').trim().toLowerCase().replace('-', ' ');
          isFullTime = deploymentType === 'full time' || deploymentType === 'fulltime';
        }
        const dailyBaseline = isFullTime ? 8 : 4;

        // Loop through all days in the billing period to calculate daily worked, PTO, and holiday hours
        let totalWorkedHours = 0;
        let totalPtoHours = 0;
        const totalHolidayHours = 0;

        for (const dayOfPeriod of allDaysList) {
          const dateStr = dayOfPeriod.toFormat('yyyy-MM-dd');
          const isWeekday = dayOfPeriod.weekday >= 1 && dayOfPeriod.weekday <= 5;

          // 1. Calculate worked hours for this day
          let dailyWorked = 0;
          if (is_prebill) {
            dailyWorked = isWeekday ? dailyBaseline : 0;
          } else {
            const dayActs = activities.filter(act => act.user_id === userId && act.day === dateStr);
            const totalSeconds = dayActs.reduce((sum, act) => sum + act.total_time_logged, 0);
            dailyWorked = totalSeconds / 3600;
          }
          totalWorkedHours += dailyWorked;

          // 2. Calculate approved PTO hours for this day
          let dailyPto = 0;
          if (isWeekday) {
            const userPtos = approvedPtos.filter(pto => pto.user_id === userId);
            for (const pto of userPtos) {
              const days = pto.time_off_request_days
                ? (Array.isArray(pto.time_off_request_days) ? pto.time_off_request_days : [pto.time_off_request_days])
                : [];
              for (const day of days) {
                if (day.date === dateStr) {
                  dailyPto += (day.amount_used || 0) * dailyBaseline;
                }
              }
            }
          }
          totalPtoHours += dailyPto;
        }

        const totalPayableHours = totalWorkedHours + totalPtoHours + totalHolidayHours;
        const hours = new Decimal(totalPayableHours);

        let hourlyRate = new Decimal(25); // Default fallback
        let lineTotal = hours.mul(hourlyRate);

        if (staff && staff.salary) {
          const monthlySalary = Number(staff.salary);

          if (isFullTime) {
            // Full-Time staff logic
            const startDT = DateTime.fromJSDate(startJSDate);
            const endDT = DateTime.fromJSDate(endJSDate);
            const diffInDays = endDT.diff(startDT, 'days').days + 1;
            const isFullMonth = diffInDays >= 27;

            const baseSalary = isFullMonth ? monthlySalary : (monthlySalary / 2);

            const workdaysInPeriod = this.getWorkdaysCount(startJSDate, endJSDate);
            const requiredHours = workdaysInPeriod * 8;
            const actualHours = totalPayableHours;
            const deficit = requiredHours - actualHours;

            if (deficit > 10) {
              // Compute hourly rate and prorate
              const prorationRate = (monthlySalary * 12) / 52 / 40;
              const prorationHourlyDecimal = new Decimal(prorationRate);
              lineTotal = hours.mul(prorationHourlyDecimal);
              hourlyRate = lineTotal;
            } else {
              // Pay full amount (baseSalary)
              lineTotal = new Decimal(baseSalary);
              hourlyRate = lineTotal;
            }
          } else {
            // Non-Full-Time staff logic
            const prorationRate = (monthlySalary * 12) / 52 / 40;
            hourlyRate = new Decimal(prorationRate);
            lineTotal = hours.mul(hourlyRate);
          }
        } else if (candidate && candidate.hourly_pay_rate) {
          hourlyRate = new Decimal(Number(candidate.hourly_pay_rate));
          lineTotal = hours.mul(hourlyRate);
        }

        const memberName = memberMap.get(userId) || `Hubstaff User ${userId}`;

        const primaryLineItem = await tx.invoiceLineItem.create({
          data: {
            invoice_version_id: version.id,
            worker_id: userId.toString(),
            worker_name_snapshot: memberName,
            type: InvoiceLineType.primary,
            category: InvoiceLineCategory.hourly_service,
            description: `Hourly services for ${memberName}`,
            effective_worked_hours: hours,
            total_hours_worked: new Decimal(totalWorkedHours),
            total_pto_hours: new Decimal(totalPtoHours),
            total_holiday_hours: new Decimal(totalHolidayHours),
            total_hours_payable: hours,
            hourly_rate: hourlyRate,
            final_total: lineTotal,
            created_by,
          },
        });

        subtotal = subtotal.add(lineTotal);

        if (staff) {
          this.logger.log('Staff found for user_id:', userId);
          this.logger.log('Staff record:', staff);
          const bonusTickets = staff.tickets || [];

          for (const ticket of bonusTickets) {
            const dollarMatch = ticket.title.match(/\$\s*([\d,]+(?:\.\d+)?)/);
            if (dollarMatch) {
              const amountStr = dollarMatch[1].replace(/,/g, '');
              const amount = parseFloat(amountStr);
              if (!isNaN(amount) && amount > 0) {
                const bonusAmount = new Decimal(amount);

                await tx.invoiceLineItem.create({
                  data: {
                    invoice_version_id: version.id,
                    parent_line_item_id: primaryLineItem.id,
                    ticket_id: ticket.id,
                    worker_id: userId.toString(),
                    worker_name_snapshot: memberName,
                    type: InvoiceLineType.additional,
                    category: InvoiceLineCategory.bonus,
                    description: `Bonus: ${ticket.description}`,
                    final_total: bonusAmount,
                    created_by,
                  },
                });

                subtotal = subtotal.add(bonusAmount);
              }
            }
          }
        }
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
