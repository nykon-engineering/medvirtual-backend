export function findMonthlySalary(hourly_pay_rate: number): number {
  if(!hourly_pay_rate || hourly_pay_rate <= 0 || isNaN(hourly_pay_rate)) return 0;
  return Number(process.env.CANDIDATE_HOUR_PER_MONTH) * (hourly_pay_rate + Number(process.env.CANDIDATE_COST_PER_HOUR));
}


export function findHourlySalary(salary: number): number {
  return salary / Number(process.env.CANDIDATE_HOUR_PER_MONTH) - Number(process.env.CANDIDATE_COST_PER_HOUR);
}