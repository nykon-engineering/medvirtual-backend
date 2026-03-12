import {
  findPayRateMonthly,
  findBillRateHourly,
  findBillRateMonthly,
} from './salary.util';

const FULL_TIME_HOURS = 176;
const PART_TIME_HOURS = 88;
const PART_TIME_CODE = '1087596819';

describe('salary.util', () => {
  describe('findPayRateMonthly', () => {
    it('uses full-time hours (176) when employment_type is not part-time code', () => {
      expect(findPayRateMonthly(10, 'some-other-code')).toBe(10 * FULL_TIME_HOURS);
    });

    it('uses part-time hours (88) when employment_type is the part-time code', () => {
      expect(findPayRateMonthly(10, PART_TIME_CODE)).toBe(10 * PART_TIME_HOURS);
    });

    it('trims whitespace from employment_type before comparing', () => {
      expect(findPayRateMonthly(10, `  ${PART_TIME_CODE}  `)).toBe(10 * PART_TIME_HOURS);
    });

    it('handles zero hourly rate', () => {
      expect(findPayRateMonthly(0, '')).toBe(0);
    });

    it('rounds to 2 decimal places', () => {
      const result = findPayRateMonthly(10.005, '');
      expect(result).toBe(Math.round(10.005 * FULL_TIME_HOURS * 100) / 100);
    });
  });

  describe('findBillRateHourly', () => {
    it('returns agreed_hourly + margin when agreed > minimum', () => {
      expect(findBillRateHourly(20, 15, 5)).toBe(25);
    });

    it('returns minimum_hourly + margin when minimum > agreed', () => {
      expect(findBillRateHourly(10, 15, 5)).toBe(20);
    });

    it('handles null minimum_hourly (treated as 0)', () => {
      expect(findBillRateHourly(20, null, 5)).toBe(25);
    });

    it('handles null margin_per_hour (treated as 0)', () => {
      expect(findBillRateHourly(20, 15, null)).toBe(20);
    });

    it('handles both null (returns agreed_hourly as-is)', () => {
      expect(findBillRateHourly(20, null, null)).toBe(20);
    });

    it('rounds to 2 decimal places', () => {
      const result = findBillRateHourly(10.005, null, 0.005);
      expect(result).toBe(Math.round((10.005 + 0.005) * 100) / 100);
    });
  });

  describe('findBillRateMonthly', () => {
    it('multiplies bill_hourly by full-time hours when not part-time', () => {
      expect(findBillRateMonthly(25, 'full-time')).toBe(25 * FULL_TIME_HOURS);
    });

    it('multiplies bill_hourly by part-time hours when part-time code', () => {
      expect(findBillRateMonthly(25, PART_TIME_CODE)).toBe(25 * PART_TIME_HOURS);
    });

    it('handles zero bill_hourly', () => {
      expect(findBillRateMonthly(0, '')).toBe(0);
    });

    it('rounds to 2 decimal places', () => {
      const result = findBillRateMonthly(10.005, '');
      expect(result).toBe(Math.round(10.005 * FULL_TIME_HOURS * 100) / 100);
    });
  });

  
});
