export function findMonthlySalary(hourly_pay_rate: number): number {
  return Number(process.env.CANDIDATE_HOUR_PER_MONTH) * (hourly_pay_rate + Number(process.env.CANDIDATE_COST_PER_HOUR));
}


export function findHourlySalary(salary: number): number {
  return salary / Number(process.env.CANDIDATE_HOUR_PER_MONTH) - Number(process.env.CANDIDATE_COST_PER_HOUR);
}