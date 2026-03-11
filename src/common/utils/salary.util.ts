// ─── Constants ────────────────────────────────────────────────────────────────
const FULL_TIME_HOURS_PER_MONTH = 176;
const PART_TIME_HOURS_PER_MONTH = 88;
const PART_TIME_EMPLOYMENT_TYPE_CODE = '1087596819';

// ─── New rate functions (Etapa 4) ─────────────────────────────────────────────

/**
 * Pay Rate (monthly) — visible to admins only.
 * agreed_hourly × hours/month depending on employment type.
 */
export function findPayRateMonthly(
  agreed_hourly: number,
  employment_type: string,
): number {
  const hours =
    employment_type?.trim() === PART_TIME_EMPLOYMENT_TYPE_CODE
      ? PART_TIME_HOURS_PER_MONTH
      : FULL_TIME_HOURS_PER_MONTH;
  return Math.round(agreed_hourly * hours * 100) / 100;
}

/**
 * Bill Rate (hourly) — visible to admins and clients.
 * effective_base = max(agreed_hourly, minimum_hourly ?? 0)
 * bill_hourly = effective_base + (margin_per_hour ?? 0)
 */
export function findBillRateHourly(
  agreed_hourly: number,
  minimum_hourly: number | null,
  margin_per_hour: number | null,
): number {
  const effectiveBase = Math.max(agreed_hourly, minimum_hourly ?? 0);
  return Math.round((effectiveBase + (margin_per_hour ?? 0)) * 100) / 100;
}

/**
 * Bill Rate (monthly) — visible to admins and clients.
 * bill_hourly × hours/month depending on employment type.
 */
export function findBillRateMonthly(
  bill_hourly: number,
  employment_type: string,
): number {
  const hours =
    employment_type?.trim() === PART_TIME_EMPLOYMENT_TYPE_CODE
      ? PART_TIME_HOURS_PER_MONTH
      : FULL_TIME_HOURS_PER_MONTH;
  return Math.round(bill_hourly * hours * 100) / 100;
}

// ─── Legacy functions (still in use, kept for compatibility) ──────────────────

export function findJustMonthlySalary(hourly_pay_rate: number): number {
  if(!hourly_pay_rate || hourly_pay_rate <= 0 || isNaN(hourly_pay_rate)) return 0;
  return Number(process.env.CANDIDATE_HOUR_PER_MONTH) * (hourly_pay_rate + Number(process.env.CANDIDATE_COST_PER_HOUR));
}

export function findHourlyPerRate(salary: number): number {
  return salary / Number(process.env.CANDIDATE_HOUR_PER_MONTH) - Number(process.env.CANDIDATE_COST_PER_HOUR);
}
