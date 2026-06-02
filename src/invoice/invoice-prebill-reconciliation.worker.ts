import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { HubstaffService } from '../hubstaff/hubstaff.service';
import { InvoiceWorker } from './invoice.worker';
import { LedgerDirection, ReconciliationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { DateTime } from 'luxon';
import { ConfigService } from '@nestjs/config';
import { isLocalMode } from '../common/bull.utils';

// ---------------------------------------------------------------------------
// Lightweight computed line item (no DB ids, pure in-memory)
// ---------------------------------------------------------------------------
interface ComputedLineItem {
  worker_id: string;
  worker_name: string;
  primary_hours: number;
  overtime_hours: number;
  hourly_rate: Decimal;
  overtime_hourly_rate: Decimal;
  primary_total: Decimal;   // primary line total
  overtime_total: Decimal;
  grand_total: Decimal;     // primary + overtime
}

/**
 * Job payload scheduled by the Stripe webhook when a pre-billed invoice is paid.
 */
export interface PrebillReconciliationJobPayload {
  invoiceId: string;
  organizationId: string;
  billingStartDate: string; // ISO date string
  billingEndDate: string;   // ISO date string
}

/**
 * Processor name — consumed by the 'invoice-prebill-reconciliation' BullMQ queue.
 *
 * How it works:
 *  1. Stripe fires invoice.paid for a prebill invoice.
 *  2. StripeService schedules a delayed job (delay = start of day after billing_end_date).
 *  3. This worker fires, fetches real Hubstaff data for the period (actual hours).
 *  4. Computes what the invoice *would* have looked like with real data.
 *  5. Compares per-worker actual vs. estimated amounts.
 *  6. Writes InvoiceLineReconciliation + BillingLedgerEntry rows.
 */
@Processor('invoice-prebill-reconciliation')
@Injectable()
export class InvoicePrebillReconciliationWorker extends WorkerHost {
  private readonly logger = new Logger(InvoicePrebillReconciliationWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hubstaff: HubstaffService,
    private readonly configService: ConfigService,
    // Reuse helper methods from InvoiceWorker (getWorkdaysCount, getHolidaysForYear)
    private readonly invoiceWorker: InvoiceWorker,
  ) {
    super();
  }

  // ---------------------------------------------------------------------------
  // Entry point
  // ---------------------------------------------------------------------------

  async process(job: Job<PrebillReconciliationJobPayload, any, string>): Promise<any> {
    if (isLocalMode(this.configService.get<string>('REDIS_BASE_KEY', ''))) {
      this.logger.warn('LOCAL mode — prebill reconciliation job skipped.');
      return;
    }
    const { invoiceId, organizationId, billingStartDate, billingEndDate } = job.data;

    this.logger.log(
      `Starting prebill reconciliation for invoice ${invoiceId} ` +
      `(org: ${organizationId}, period: ${billingStartDate} → ${billingEndDate})`,
    );

    // -----------------------------------------------------------------------
    // 1. Load the invoice + its current (prebill) version with line items
    // -----------------------------------------------------------------------
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        currentVersion: {
          include: { line_items: true },
        },
        organization: {
          include: { invoiceConfiguration: true },
        },
      },
    });

    if (!invoice) {
      this.logger.warn(`Invoice ${invoiceId} not found — skipping prebill reconciliation`);
      return;
    }

    const prebillLineItems = invoice.currentVersion?.line_items ?? [];
    if (prebillLineItems.length === 0) {
      this.logger.warn(`Invoice ${invoiceId} has no line items — skipping prebill reconciliation`);
      return;
    }

    const org = invoice.organization;
    const hubstaffId = org?.invoiceConfiguration?.hubstaff_id;
    if (!hubstaffId) {
      this.logger.warn(`No Hubstaff ID for org ${organizationId} — skipping prebill reconciliation`);
      return;
    }

    // -----------------------------------------------------------------------
    // 2. Compute actual line items from real Hubstaff data (no DB writes)
    // -----------------------------------------------------------------------
    const actualLines = await this.computeActualLineItems({
      org,
      hubstaffId,
      organizationId,
      billingStartDate,
      billingEndDate,
    });

    this.logger.log(
      `Computed ${actualLines.length} actual line item(s) for invoice ${invoiceId}`,
    );

    // -----------------------------------------------------------------------
    // 3. Build a per-worker map of prebill primary-line final_totals
    //    (sum all line items per worker_id in the prebill version)
    // -----------------------------------------------------------------------
    const prebillByWorker = new Map<string, { lineItemId: string; estimatedTotal: Decimal }>();
    for (const li of prebillLineItems) {
      if (!li.worker_id) continue;
      const existing = prebillByWorker.get(li.worker_id);
      if (existing) {
        existing.estimatedTotal = existing.estimatedTotal.add(li.final_total ?? 0);
      } else {
        // Use first encountered line item id for the linkage (primary line)
        prebillByWorker.set(li.worker_id, {
          lineItemId: li.id,
          estimatedTotal: new Decimal(li.final_total ?? 0),
        });
      }
    }

    // -----------------------------------------------------------------------
    // 4. Clear any existing reconciliation + ledger rows for this invoice
    //    so reruns (manual or automated) are fully idempotent
    // -----------------------------------------------------------------------
    const lineItemIds = prebillLineItems.map((li) => li.id);

    if (lineItemIds.length > 0) {
      // Ledger entries reference reconciliations — delete them first
      const existingRecons = await this.prisma.invoiceLineReconciliation.findMany({
        where: { line_item_id: { in: lineItemIds } },
        select: { id: true },
      });
      const reconIds = existingRecons.map((r) => r.id);

      if (reconIds.length > 0) {
        await this.prisma.billingLedgerEntry.deleteMany({
          where: { reconciliation_id: { in: reconIds } },
        });
      }

      await this.prisma.invoiceLineReconciliation.deleteMany({
        where: { line_item_id: { in: lineItemIds } },
      });

      this.logger.log(
        `Cleared ${existingRecons.length} existing reconciliation record(s) for invoice ${invoiceId}`,
      );
    }

    // -----------------------------------------------------------------------
    // 5. Reconcile: for each actual line, find matching prebill line and record delta
    // -----------------------------------------------------------------------
    let reconciledCount = 0;

    for (const actual of actualLines) {
      const prebill = prebillByWorker.get(actual.worker_id);

      if (!prebill) {
        this.logger.warn(
          `No matching prebill line for worker ${actual.worker_id} in invoice ${invoiceId} — skipping`,
        );
        continue;
      }

      const estimatedAmount = prebill.estimatedTotal;
      const actualAmount = actual.grand_total;
      const deltaAmount = actualAmount.sub(estimatedAmount);

      // direction: credit if client owes more (actual > prebill), debit if client was overbilled
      const direction: LedgerDirection =
        deltaAmount.gte(0) ? LedgerDirection.debit : LedgerDirection.credit;
      const absAmount = deltaAmount.abs();

      await this.prisma.$transaction(async (tx) => {
        // InvoiceLineReconciliation
        const recon = await tx.invoiceLineReconciliation.create({
          data: {
            line_item_id: prebill.lineItemId,
            organization_id: organizationId,
            worker_id: actual.worker_id,
            estimated_amount: estimatedAmount,
            actual_amount: actualAmount,
            delta_amount: deltaAmount,
            status: ReconciliationStatus.completed,
            completedAt: new Date(),
          },
        });

        // BillingLedgerEntry
        await tx.billingLedgerEntry.create({
          data: {
            organization_id: organizationId,
            worker_id: actual.worker_id,
            line_item_id: prebill.lineItemId,
            reconciliation_id: recon.id,
            direction,
            amount: absAmount,
            remaining_amount: absAmount,
          },
        });

        // Audit log
        await tx.invoiceAuditLog.create({
          data: {
            invoice_id: invoiceId,
            line_item_id: prebill.lineItemId,
            actor_id: null,
            event:
              `[Prebill Reconciliation] Worker ${actual.worker_id}: ` +
              `estimated=${estimatedAmount.toFixed(2)}, actual=${actualAmount.toFixed(2)}, ` +
              `delta=${deltaAmount.toFixed(2)} (${direction})`,
          },
        });
      });

      reconciledCount++;
    }

    const summary = {
      invoiceId,
      prebillWorkerCount: prebillByWorker.size,
      actualWorkerCount: actualLines.length,
      reconciledCount,
    };

    this.logger.log(`Prebill reconciliation complete: ${JSON.stringify(summary)}`);
    return summary;
  }

  // ---------------------------------------------------------------------------
  // Private: compute actual per-worker totals from Hubstaff (no DB writes)
  // ---------------------------------------------------------------------------

  private async computeActualLineItems(params: {
    org: any;
    hubstaffId: string;
    organizationId: string;
    billingStartDate: string;
    billingEndDate: string;
  }): Promise<ComputedLineItem[]> {
    const { org, hubstaffId, organizationId, billingStartDate, billingEndDate } = params;

    // --- Members ---
    const members = await this.hubstaff.getProjectMembers(hubstaffId);

    const memberMap = new Map<number, string>();
    members.forEach((m: any) => {
      if (m.user_id) {
        memberMap.set(m.user_id, m.name || m.user?.name || `Hubstaff User ${m.user_id}`);
      }
    });

    const hubstaffUserIds = members
      .map((m: any) => (m.user_id ? String(m.user_id) : null))
      .filter((id): id is string => !!id);

    const startOfPeriod = DateTime.fromISO(billingStartDate, { zone: 'utc' }).startOf('day').toJSDate();
    const endOfPeriod = DateTime.fromISO(billingEndDate, { zone: 'utc' }).endOf('day').toJSDate();

    // --- Staff / candidate records (for rates) ---
    const staffRecords =
      hubstaffUserIds.length > 0
        ? await this.prisma.staff.findMany({
            where: {
              candidate: { hubstaff_id: { in: hubstaffUserIds } },
              OR: [
                { organization_id: organizationId },
                ...(org.hubspot_id ? [{ hubspot_organization_id: org.hubspot_id }] : []),
              ],
            },
            include: { candidate: true },
          })
        : [];

    // --- Actual Hubstaff activities ---
    const activities = await this.hubstaff.getHubstaffDailyActivityForInvoice({
      hubstaffId: Number(hubstaffId),
      start_date: billingStartDate,
      end_date: billingEndDate,
    });

    // Aggregate tracked seconds per user
    const userSummary = new Map<number, number>();
    for (const act of activities) {
      if (act.user_name) {
        memberMap.set(act.user_id, act.user_name);
      }
      userSummary.set(act.user_id, (userSummary.get(act.user_id) ?? 0) + act.total_time_logged);
    }

    // --- PTO ---
    const uniqueUserIds = Array.from(
      new Set([...hubstaffUserIds, ...activities.map((a: any) => String(a.user_id))]),
    );
    const startISO = DateTime.fromISO(billingStartDate, { zone: 'utc' }).startOf('day').toISO() || undefined;
    const endISO =
      DateTime.fromISO(billingEndDate, { zone: 'utc' }).plus({ days: 1 }).startOf('day').toISO() || undefined;

    const ptoRequests =
      uniqueUserIds.length > 0
        ? await this.hubstaff.getTimeOffRequests(uniqueUserIds, startISO, endISO)
        : [];
    const approvedPtos = ptoRequests.filter((p: any) => p.status === 'approved');

    // --- Date / holiday helpers ---
    const startJSDate = DateTime.fromISO(billingStartDate, { zone: 'utc' }).toJSDate();
    const endJSDate = DateTime.fromISO(billingEndDate, { zone: 'utc' }).toJSDate();

    const allDaysList: DateTime[] = [];
    let curDate = DateTime.fromJSDate(startJSDate, { zone: 'utc' }).startOf('day');
    const lastDate = DateTime.fromJSDate(endJSDate, { zone: 'utc' }).startOf('day');
    while (curDate.toMillis() <= lastDate.toMillis()) {
      allDaysList.push(curDate);
      curDate = curDate.plus({ days: 1 });
    }

    const startYear = DateTime.fromISO(billingStartDate, { zone: 'utc' }).year;
    const endYear = DateTime.fromISO(billingEndDate, { zone: 'utc' }).year;
    const holidayDates = new Set<string>();
    for (let y = startYear; y <= endYear; y++) {
      this.invoiceWorker.getHolidaysForYear(y).forEach((h) => holidayDates.add(h));
    }

    // --- Compute per-worker line items ---
    const result: ComputedLineItem[] = [];

    // Union of workers: those with actual activity + those in memberMap who had prebill entries
    const workerIdsToProcess = new Set<number>([...userSummary.keys()]);

    for (const userId of workerIdsToProcess) {
      const staff = staffRecords.find((s) => s.candidate?.hubstaff_id === String(userId)) ?? null;
      const candidate = staff?.candidate ?? null;

      const deploymentType = (staff?.hubspot_deployment_type ?? '').trim().toLowerCase().replace('-', ' ');
      const isFullTime = deploymentType === 'full time' || deploymentType === 'fulltime';
      const dailyBaseline = isFullTime ? 8 : 4;

      let totalWorkedHours = 0;
      let totalPtoHours = 0;
      let totalHolidayHours = 0;
      let actualWorkedHoursOnHolidays = 0;

      for (const dayOfPeriod of allDaysList) {
        const dateStr = dayOfPeriod.toFormat('yyyy-MM-dd');
        const isWeekday = dayOfPeriod.weekday >= 1 && dayOfPeriod.weekday <= 5;
        const isHoliday = isWeekday && holidayDates.has(dateStr);

        // Actual worked hours from Hubstaff activities
        const dayActs = activities.filter(
          (act: any) => act.user_id === userId && act.day === dateStr,
        );
        const dailyWorked = dayActs.reduce((s: number, a: any) => s + a.total_time_logged, 0) / 3600;
        totalWorkedHours += dailyWorked;

        if (isHoliday) {
          let dailyHolidayPayable = dailyBaseline;
          if (dailyWorked > 0) {
            dailyHolidayPayable += dailyWorked * 0.5;
            actualWorkedHoursOnHolidays += dailyWorked;
          }
          totalHolidayHours += dailyHolidayPayable;
        } else if (isWeekday) {
          const userPtos = approvedPtos.filter((p: any) => p.user_id === userId);
          for (const pto of userPtos) {
            const days: any[] = Array.isArray(pto.time_off_request_days)
              ? pto.time_off_request_days
              : pto.time_off_request_days
              ? [pto.time_off_request_days]
              : [];
            for (const day of days) {
              if (day.date === dateStr) {
                totalPtoHours += (day.amount_used ?? 0) / 3600;
              }
            }
          }
        }
      }

      const totalPayableHours =
        totalWorkedHours - actualWorkedHoursOnHolidays + totalPtoHours + totalHolidayHours;

      const workdaysInPeriod = this.invoiceWorker.getWorkdaysCount(startJSDate, endJSDate);
      const requiredHours = workdaysInPeriod * dailyBaseline;
      const actualHours = totalPayableHours;
      const hasOvertime = actualHours > requiredHours + 4;

      let primaryHours = actualHours;
      let overtimeHours = 0;
      let hourlyRate = new Decimal(25);
      let overtimeHourlyRate = new Decimal(0);
      let lineTotal = new Decimal(totalPayableHours).mul(hourlyRate);
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
            const diffInDays =
              DateTime.fromJSDate(endJSDate, { zone: 'utc' }).diff(DateTime.fromJSDate(startJSDate, { zone: 'utc' }), 'days').days + 1;
            const baseSalary = diffInDays >= 27 ? monthlySalary : monthlySalary / 2;
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
            const diffInDays =
              DateTime.fromJSDate(endJSDate, { zone: 'utc' }).diff(DateTime.fromJSDate(startJSDate, { zone: 'utc' }), 'days').days + 1;
            const baseSalary = diffInDays >= 27 ? monthlySalary : monthlySalary / 2;
            const deficit = requiredHours - actualHours;
            if (deficit > 10) {
              const prorationRate = (monthlySalary * 12) / 52 / 40;
              lineTotal = new Decimal(totalPayableHours).mul(new Decimal(prorationRate));
            } else {
              lineTotal = new Decimal(baseSalary);
            }
            hourlyRate =
              totalPayableHours > 0 ? lineTotal.div(new Decimal(totalPayableHours)) : new Decimal(0);
          } else {
            const prorationRate = (monthlySalary * 12) / 52 / 40;
            hourlyRate = new Decimal(prorationRate);
            lineTotal = new Decimal(totalPayableHours).mul(hourlyRate);
          }
        } else if (candidate && candidate.hourly_pay_rate) {
          hourlyRate = new Decimal(Number(candidate.hourly_pay_rate));
          lineTotal = new Decimal(totalPayableHours).mul(hourlyRate);
        }
      }

      result.push({
        worker_id: String(userId),
        worker_name: memberMap.get(userId) ?? `Hubstaff User ${userId}`,
        primary_hours: primaryHours,
        overtime_hours: overtimeHours,
        hourly_rate: hourlyRate,
        overtime_hourly_rate: overtimeHourlyRate,
        primary_total: lineTotal,
        overtime_total: overtimeTotal,
        grand_total: lineTotal.add(overtimeTotal),
      });
    }

    return result;
  }
}
