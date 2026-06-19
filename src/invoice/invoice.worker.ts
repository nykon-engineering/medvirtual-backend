import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { HubstaffService } from '../hubstaff/hubstaff.service';
import { PusherService } from '../pusher/pusher.service';
import { InvoiceJobStatus, InvoiceStatus, InvoiceVersionStatus, InvoiceLineType, InvoiceLineCategory, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { DateTime } from 'luxon';
import { StripeService } from '../stripe/stripe.service';
import { ConfigService } from '@nestjs/config';
import { isLocalMode } from '../common/bull.utils';

@Processor('invoice')
@Injectable()
export class InvoiceWorker extends WorkerHost {
  private readonly logger = new Logger(InvoiceWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hubstaff: HubstaffService,
    private readonly pusher: PusherService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
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

  public getWorkdaysCount(startDate: Date, endDate: Date): number {
    let count = 0;
    let curDate = DateTime.fromJSDate(startDate, { zone: 'utc' }).startOf('day');
    const lastDate = DateTime.fromJSDate(endDate, { zone: 'utc' }).startOf('day');
    while (curDate.toMillis() <= lastDate.toMillis()) {
      const dayOfWeek = curDate.weekday; // 1 = Monday, 7 = Sunday in Luxon
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++;
      }
      curDate = curDate.plus({ days: 1 });
    }
    return count;
  }

  public getHolidaysForYear(year: number): string[] {
    const holidays: string[] = [];

    // 1. New Year's Day (Jan 1)
    holidays.push(DateTime.fromObject({ year, month: 1, day: 1 }).toFormat('yyyy-MM-dd'));

    // 2. Memorial Day (last Monday of May)
    let memorialDay = DateTime.fromObject({ year, month: 5, day: 31 });
    while (memorialDay.weekday !== 1) { // 1 = Monday in Luxon
      memorialDay = memorialDay.minus({ days: 1 });
    }
    holidays.push(memorialDay.toFormat('yyyy-MM-dd'));

    // 3. Independence Day (July 4)
    holidays.push(DateTime.fromObject({ year, month: 7, day: 4 }).toFormat('yyyy-MM-dd'));

    // 4. Labor Day (first Monday of September)
    let laborDay = DateTime.fromObject({ year, month: 9, day: 1 });
    while (laborDay.weekday !== 1) {
      laborDay = laborDay.plus({ days: 1 });
    }
    holidays.push(laborDay.toFormat('yyyy-MM-dd'));

    // 5. Thanksgiving (fourth Thursday of November)
    let thanksgiving = DateTime.fromObject({ year, month: 11, day: 1 });
    while (thanksgiving.weekday !== 4) { // 4 = Thursday in Luxon
      thanksgiving = thanksgiving.plus({ days: 1 });
    }
    thanksgiving = thanksgiving.plus({ weeks: 3 });
    holidays.push(thanksgiving.toFormat('yyyy-MM-dd'));

    // 6. Christmas (Dec 25)
    holidays.push(DateTime.fromObject({ year, month: 12, day: 25 }).toFormat('yyyy-MM-dd'));

    return holidays;
  }


  async process(job: Job<any, any, string>): Promise<any> {
    if (isLocalMode(this.configService.get<string>('REDIS_BASE_KEY', ''))) {
      this.logger.warn(`LOCAL mode — invoice job '${job.name}' skipped.`);
      return;
    }
    if (job.name === 'attempt-collection') {
      const { invoiceId, stripeInvoiceId } = job.data;
      this.logger.log(`Attempting collection for invoice ${invoiceId} / Stripe ${stripeInvoiceId}`);
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (invoice && invoice.status !== 'paid') {
        try {
          await this.stripeService.payInvoice(stripeInvoiceId);
          this.logger.log(`Successfully collected payment for invoice ${invoiceId}`);
        } catch (err) {
          this.logger.error(`Failed to collect payment for invoice ${invoiceId}: ${err.message}`);
          throw err; // retry job
        }
      }
      return;
    }

    if (job.name !== 'generate-invoice') {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    const payload = job.data;
    const { job_id, organization_id, billing_start_date, billing_end_date, created_by, is_prebill, isCustom } = payload;

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

      if (!org) {
        throw new Error('Organization not found');
      }

      if (!isCustom && (!org.invoiceConfiguration || !org.invoiceConfiguration.hubstaff_id)) {
        throw new Error('Organization Hubstaff connection missing');
      }

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
      isCustom,
      allowFees,
      ops,
      fee,
      created_by
    } = payload;

    if (isCustom) {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Create Invoice Header
        const invoice = await tx.invoice.create({
          data: {
            organization_id,
            status: InvoiceStatus.draft,
            created_by,
            billing_start_date: DateTime.fromISO(billing_start_date, { zone: 'utc' }).toJSDate(),
            billing_end_date: DateTime.fromISO(billing_end_date, { zone: 'utc' }).toJSDate(),
            reference: this.generateReference(),
            is_custom: true,
          },
        });

        // 2. Create Invoice Version (Draft)
        const version = await tx.invoiceVersion.create({
          data: {
            invoice_id: invoice.id,
            version_number: 1,
            status: InvoiceVersionStatus.draft,
            currency: org?.invoiceConfiguration?.billing_currency || 'USD',
            billing_start_date: DateTime.fromISO(billing_start_date, { zone: 'utc' }).toJSDate(),
            billing_end_date: DateTime.fromISO(billing_end_date, { zone: 'utc' }).toJSDate(),
            issue_date: issue_date ? DateTime.fromISO(issue_date, { zone: 'utc' }).toJSDate() : null,
            due_date: due_date ? DateTime.fromISO(due_date, { zone: 'utc' }).toJSDate() : null,
            public_due_date: public_due_date ? DateTime.fromISO(public_due_date, { zone: 'utc' }).toJSDate() : null,
            is_prebill: is_prebill || false,
            allow_fees: allowFees || false,
            created_by,
            subtotal: 0,
            total: 0,
            discountType: 'dollar',
            discountValue: 0,
          },
        });

        // 3. Link Version to Invoice Header
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { current_version_id: version.id },
        });

        return invoice;
      });
    }

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

    const startOfPeriod = DateTime.fromISO(billing_start_date, { zone: 'utc' }).startOf('day').toJSDate();
    const endOfPeriod = DateTime.fromISO(billing_end_date, { zone: 'utc' }).endOf('day').toJSDate();

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
      const startDate = DateTime.fromISO(billing_start_date, { zone: 'utc' }).toJSDate();
      const endDate = DateTime.fromISO(billing_end_date, { zone: 'utc' }).toJSDate();
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
    const startDateISO = DateTime.fromISO(billing_start_date, { zone: 'utc' }).startOf('day').toISO() || undefined;
    const endDateISO = DateTime.fromISO(billing_end_date, { zone: 'utc' }).plus({ days: 1 }).startOf('day').toISO() || undefined;

    const ptoRequests = (uniqueUserIdsForPto.length > 0)
      ? await this.hubstaff.getTimeOffRequests(uniqueUserIdsForPto, startDateISO, endDateISO)
      : [];

    const approvedPtos = ptoRequests.filter(pto => pto.status === 'approved');

    // Define the list of all days in the billing period
    const startJSDate = DateTime.fromISO(billing_start_date, { zone: 'utc' }).toJSDate();
    const endJSDate = DateTime.fromISO(billing_end_date, { zone: 'utc' }).toJSDate();
    let curDate = DateTime.fromJSDate(startJSDate, { zone: 'utc' }).startOf('day');
    const lastDate = DateTime.fromJSDate(endJSDate, { zone: 'utc' }).startOf('day');
    const allDaysList: DateTime[] = [];
    while (curDate.toMillis() <= lastDate.toMillis()) {
      allDaysList.push(curDate);
      curDate = curDate.plus({ days: 1 });
    }

    const startYear = DateTime.fromISO(billing_start_date, { zone: 'utc' }).year;
    const endYear = DateTime.fromISO(billing_end_date, { zone: 'utc' }).year;
    const holidayDates = new Set<string>();
    for (let y = startYear; y <= endYear; y++) {
      this.getHolidaysForYear(y).forEach(h => holidayDates.add(h));
    }

    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create Invoice Header
      const invoice = await tx.invoice.create({
        data: {
          organization_id,
          status: InvoiceStatus.draft,
          created_by,
          billing_start_date: DateTime.fromISO(billing_start_date, { zone: 'utc' }).toJSDate(),
          billing_end_date: DateTime.fromISO(billing_end_date, { zone: 'utc' }).toJSDate(),
          reference: this.generateReference(),
          is_custom: false,
        },
      });

      // 2. Create Invoice Version (Draft)
      const version = await tx.invoiceVersion.create({
        data: {
          invoice_id: invoice.id,
          version_number: 1,
          status: InvoiceVersionStatus.draft,
          currency: org.invoiceConfiguration.billing_currency || 'USD',
          billing_start_date: DateTime.fromISO(billing_start_date, { zone: 'utc' }).toJSDate(),
          billing_end_date: DateTime.fromISO(billing_end_date, { zone: 'utc' }).toJSDate(),
          issue_date: issue_date ? DateTime.fromISO(issue_date, { zone: 'utc' }).toJSDate() : null,
          due_date: due_date ? DateTime.fromISO(due_date, { zone: 'utc' }).toJSDate() : null,
          public_due_date: public_due_date ? DateTime.fromISO(public_due_date, { zone: 'utc' }).toJSDate() : null,
          is_prebill: is_prebill || false, // Pre-bill flag from DTO
          allow_fees: allowFees || false,
          created_by,
          subtotal: 0,
          total: 0,
          discountType: 'dollar',
          discountValue: 0,
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
        let totalHolidayHours = 0;
        let actualWorkedHoursOnHolidays = 0;

        for (const dayOfPeriod of allDaysList) {
          const dateStr = dayOfPeriod.toFormat('yyyy-MM-dd');
          const isWeekday = dayOfPeriod.weekday >= 1 && dayOfPeriod.weekday <= 5;
          const isHoliday = isWeekday && holidayDates.has(dateStr);

          // 1. Calculate worked hours for this day
          let dailyWorked = 0;
          if (is_prebill) {
            // Pre-bill assumes baseline hours on weekday non-holidays,
            // and 0 worked hours on holidays (they just get standard holiday pay at 100%).
            dailyWorked = (isWeekday && !isHoliday) ? dailyBaseline : 0;
          } else {
            const dayActs = activities.filter(act => act.user_id === userId && act.day === dateStr);
            const totalSeconds = dayActs.reduce((sum, act) => sum + act.total_time_logged, 0);
            dailyWorked = totalSeconds / 3600;
          }
          totalWorkedHours += dailyWorked;

          if (isHoliday) {
            // Holiday billing logic:
            // If VA does NOT work (dailyWorked is zero): You bill required hours (dailyBaseline)
            // If VA DOES work (dailyWorked > zero): You bill required hours (dailyBaseline) + dailyWorked * 50%
            let dailyHolidayPayable = dailyBaseline;
            if (dailyWorked > 0) {
              dailyHolidayPayable += dailyWorked * 0.5;
              actualWorkedHoursOnHolidays += dailyWorked;
            }
            totalHolidayHours += dailyHolidayPayable;
          } else {
            // 2. Calculate approved PTO hours for this day (only on non-holiday weekdays)
            // Note: If a day is a holiday, we ignore any approved PTO requests for it
            // since the holiday block above already pipes in the holiday pay.
            let dailyPto = 0;
            if (isWeekday) {
              const userPtos = approvedPtos.filter(pto => pto.user_id === userId);
              for (const pto of userPtos) {
                const days = pto.time_off_request_days
                  ? (Array.isArray(pto.time_off_request_days) ? pto.time_off_request_days : [pto.time_off_request_days])
                  : [];
                for (const day of days) {
                  if (day.date === dateStr) {
                    dailyPto += (day.amount_used || 0) / 3600;
                  }
                }
              }
            }
            totalPtoHours += dailyPto;
          }
        }

        const totalPayableHours = (totalWorkedHours - actualWorkedHoursOnHolidays) + totalPtoHours + totalHolidayHours;
        const hours = new Decimal(totalPayableHours);

        const workdaysInPeriod = this.getWorkdaysCount(startJSDate, endJSDate);
        const requiredHours = workdaysInPeriod * dailyBaseline;
        const actualHours = totalPayableHours;
        const hasOvertime = actualHours > requiredHours + 4;

        let hourlyRate = new Decimal(25); // Default fallback
        let lineTotal = hours.mul(hourlyRate);
        let primaryHours = actualHours;

        let overtimeHours = 0;
        let overtimeHourlyRate = new Decimal(0);
        let overtimeTotal = new Decimal(0);

        if (hasOvertime) {
          overtimeHours = actualHours - requiredHours;
          primaryHours = requiredHours;

          if (staff && staff.salary) {
            const monthlySalary = Number(staff.salary);
            const prorationRate = (monthlySalary * 12) / 52 / 40;
            overtimeHourlyRate = new Decimal(prorationRate);
            overtimeTotal = new Decimal(overtimeHours).mul(overtimeHourlyRate);

            if (isFullTime) {
              const startDT = DateTime.fromJSDate(startJSDate, { zone: 'utc' });
              const endDT = DateTime.fromJSDate(endJSDate, { zone: 'utc' });
              const diffInDays = endDT.diff(startDT, 'days').days + 1;
              const isFullMonth = diffInDays >= 27;

              const baseSalary = isFullMonth ? monthlySalary : (monthlySalary / 2);
              lineTotal = new Decimal(baseSalary);
              hourlyRate = primaryHours > 0 ? lineTotal.div(new Decimal(primaryHours)) : new Decimal(0);
            } else {
              hourlyRate = new Decimal(prorationRate);
              lineTotal = new Decimal(primaryHours).mul(hourlyRate);
            }
          } else if (candidate && candidate.hourly_pay_rate) {
            const rate = Number(candidate.hourly_pay_rate);
            hourlyRate = new Decimal(rate);
            lineTotal = new Decimal(primaryHours).mul(hourlyRate);
            overtimeHourlyRate = new Decimal(rate);
            overtimeTotal = new Decimal(overtimeHours).mul(overtimeHourlyRate);
          } else {
            hourlyRate = new Decimal(25);
            lineTotal = new Decimal(primaryHours).mul(hourlyRate);
            overtimeHourlyRate = new Decimal(25);
            overtimeTotal = new Decimal(overtimeHours).mul(overtimeHourlyRate);
          }
        } else {
          if (staff && staff.salary) {
            const monthlySalary = Number(staff.salary);

            if (isFullTime) {
              // Full-Time staff logic
              const startDT = DateTime.fromJSDate(startJSDate, { zone: 'utc' });
              const endDT = DateTime.fromJSDate(endJSDate, { zone: 'utc' });
              const diffInDays = endDT.diff(startDT, 'days').days + 1;
              const isFullMonth = diffInDays >= 27;

              const baseSalary = isFullMonth ? monthlySalary : (monthlySalary / 2);

              const deficit = requiredHours - actualHours;

              if (deficit > 10) {
                // Compute hourly rate and prorate
                const prorationRate = (monthlySalary * 12) / 52 / 40;
                const prorationHourlyDecimal = new Decimal(prorationRate);
                lineTotal = hours.mul(prorationHourlyDecimal);
              } else {
                // Pay full amount (baseSalary)
                lineTotal = new Decimal(baseSalary);
              }
              hourlyRate = hours.gt(0) ? lineTotal.div(hours) : new Decimal(0);
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
            effective_worked_hours: new Decimal(primaryHours),
            total_hours_worked: new Decimal(totalWorkedHours),
            total_pto_hours: new Decimal(totalPtoHours),
            total_holiday_hours: new Decimal(totalHolidayHours),
            total_hours_payable: new Decimal(primaryHours),
            hourly_rate: hourlyRate,
            service_amount: lineTotal,
            operations_cost: allowFees ? new Decimal(ops || 0) : new Decimal(0),
            medvirtual_fees: allowFees ? new Decimal(fee || 0) : new Decimal(0),
            final_total: allowFees
              ? lineTotal.add(new Decimal(ops || 0)).add(new Decimal(fee || 0))
              : lineTotal,
            is_full_time: isFullTime,
            created_by,
          },
        });

        const lineItemTotal = allowFees
          ? lineTotal.add(new Decimal(ops || 0)).add(new Decimal(fee || 0))
          : lineTotal;
        subtotal = subtotal.add(lineItemTotal);

        if (hasOvertime) {
          await tx.invoiceLineItem.create({
            data: {
              invoice_version_id: version.id,
              parent_line_item_id: primaryLineItem.id,
              worker_id: userId.toString(),
              worker_name_snapshot: memberName,
              type: InvoiceLineType.additional,
              category: InvoiceLineCategory.overtime,
              description: `Overtime: ${overtimeHours.toFixed(2)} hours`,
              effective_worked_hours: new Decimal(overtimeHours),
              total_hours_payable: new Decimal(overtimeHours),
              hourly_rate: overtimeHourlyRate,
              final_total: overtimeTotal,
              is_full_time: isFullTime,
              created_by,
            },
          });
          subtotal = subtotal.add(overtimeTotal);
        }

        if (staff) {
          this.logger.log('Staff found for user_id:', userId);
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
                    description: `${ticket.description}`,
                    effective_worked_hours: new Decimal(1),
                    total_hours_worked: new Decimal(1),
                    total_hours_payable: new Decimal(1),
                    hourly_rate: bonusAmount,
                    final_total: bonusAmount,
                    is_full_time: isFullTime,
                    created_by,
                  },
                });

                subtotal = subtotal.add(bonusAmount);
              }
            }
          }
        }
      }

      // 4. Apply any pending BillingLedgerEntry adjustments for this org/period
      //    These are reconciliation deltas from previous pre-billed invoices that
      //    have not yet been applied to a subsequent invoice line item.
      const workerIds = Array.from(userSummary.keys()).map(String);

      if (workerIds.length > 0) {
        const pendingLedgerEntries = await tx.billingLedgerEntry.findMany({
          where: {
            organization_id,
            worker_id: { in: workerIds },
            applied_to_line_item_id: null,
          },
        });

        for (const ledgerEntry of pendingLedgerEntries) {
          // Find the primary line item on this version for the same worker
          const matchingLineItem = await tx.invoiceLineItem.findFirst({
            where: {
              invoice_version_id: version.id,
              worker_id: ledgerEntry.worker_id,
              type: InvoiceLineType.primary,
            },
          });

          if (!matchingLineItem) continue;

          // debit  = client owes more (actual > prebill) → add to invoice
          // credit = client was overbilled               → deduct from invoice
          const isDebit = ledgerEntry.direction === 'debit';
          const adjustmentAmount = new Decimal(ledgerEntry.remaining_amount);
          const signedAmount = isDebit ? adjustmentAmount : adjustmentAmount.negated();

          const adjustmentLine = await tx.invoiceLineItem.create({
            data: {
              invoice_version_id: version.id,
              parent_line_item_id: matchingLineItem.id,
              worker_id: ledgerEntry.worker_id ?? undefined,
              worker_name_snapshot: matchingLineItem.worker_name_snapshot,
              type: InvoiceLineType.additional,
              category: isDebit
                ? InvoiceLineCategory.reconciliation_debit
                : InvoiceLineCategory.reconciliation_credit,
              description: isDebit
                ? `Invoice Adjustment - Overtime`
                : `Invoice Adjustment - Unworked Hours`,
              effective_worked_hours: new Decimal(0),
              total_hours_payable: new Decimal(0),
              hourly_rate: new Decimal(0),
              final_total: signedAmount,
              is_full_time: matchingLineItem.is_full_time,
              created_by,
            },
          });

          subtotal = subtotal.add(signedAmount);

          // Link the ledger entry to this new line item
          await tx.billingLedgerEntry.update({
            where: { id: ledgerEntry.id },
            data: { applied_to_line_item_id: adjustmentLine.id },
          });
        }
      }

      // 5. Update Version Totals
      const finalVersion = await tx.invoiceVersion.update({
        where: { id: version.id },
        data: {
          subtotal,
          total: subtotal, // Tax handling can be added later
        },
      });

      // 6. Link Version to Invoice Header
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
