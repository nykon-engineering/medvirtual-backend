import { InvoiceWorker } from '../src/invoice/invoice.worker';
import { DateTime } from 'luxon';

async function runTest() {
  console.log('🚀 Running Holiday Billing Verification...');

  const mockPrisma: any = {};
  const mockHubstaff: any = {};
  const mockPusher: any = {};
  const mockStripe: any = {};

  const worker = new InvoiceWorker(mockPrisma, mockHubstaff, mockPusher, mockStripe);

  // 1. Verify getHolidaysForYear
  const holidays2026 = worker.getHolidaysForYear(2026);
  console.log('\nHolidays generated for year 2026:');
  console.log(holidays2026);

  const expectedHolidays = [
    '2026-01-01', // New Year's
    '2026-05-25', // Memorial Day (Last Monday of May)
    '2026-07-04', // Independence Day
    '2026-09-07', // Labor Day (First Monday of Sept)
    '2026-11-26', // Thanksgiving (Fourth Thursday of Nov)
    '2026-12-25', // Christmas
  ];

  let allPass = true;
  for (const expected of expectedHolidays) {
    if (holidays2026.includes(expected)) {
      console.log(`✅ Found expected holiday: ${expected}`);
    } else {
      console.error(`❌ Missing expected holiday: ${expected}`);
      allPass = false;
    }
  }

  if (holidays2026.length !== 6) {
    console.error(`❌ Expected exactly 6 holidays, but got ${holidays2026.length}`);
    allPass = false;
  }

  // 2. Simulating the modified billing logic for different holiday scenarios
  console.log('\nSimulating Daily Billing calculations on holidays (Baseline = 8 hours):');
  const dailyBaseline = 8;
  const holidayDates = new Set(holidays2026);

  const testCases = [
    {
      description: 'VA does NOT work on holiday',
      isHoliday: true,
      dailyWorked: 0,
      expectedHolidayHours: 8,
      expectedWorkedHours: 0,
    },
    {
      description: 'VA works 4 hours on holiday',
      isHoliday: true,
      dailyWorked: 4,
      expectedHolidayHours: 10, // 8 + 4 * 0.5
      expectedWorkedHours: 4,
    },
    {
      description: 'VA works 8 hours on holiday',
      isHoliday: true,
      dailyWorked: 8,
      expectedHolidayHours: 12, // 8 + 8 * 0.5
      expectedWorkedHours: 8,
    },
    {
      description: 'VA works 8 hours on regular day',
      isHoliday: false,
      dailyWorked: 8,
      expectedHolidayHours: 0,
      expectedWorkedHours: 8,
    }
  ];

  for (const tc of testCases) {
    let totalWorkedHours = 0;
    let totalPtoHours = 0;
    let totalHolidayHours = 0;
    let actualWorkedHoursOnHolidays = 0;

    // Simulate single day processing
    const dailyWorked = tc.dailyWorked;
    totalWorkedHours += dailyWorked;

    if (tc.isHoliday) {
      let dailyHolidayPayable = dailyBaseline;
      if (dailyWorked > 0) {
        dailyHolidayPayable += dailyWorked * 0.5;
        actualWorkedHoursOnHolidays += dailyWorked;
      }
      totalHolidayHours += dailyHolidayPayable;
    }

    const totalPayableHours = (totalWorkedHours - actualWorkedHoursOnHolidays) + totalPtoHours + totalHolidayHours;
    
    console.log(`- Scenario: ${tc.description}`);
    console.log(`  Worked: ${dailyWorked} hrs, Holiday Payable: ${totalHolidayHours} hrs, Total Payable: ${totalPayableHours} hrs`);

    if (totalHolidayHours !== tc.expectedHolidayHours) {
      console.error(`  ❌ Failed Holiday Payable Hours. Got ${totalHolidayHours}, expected ${tc.expectedHolidayHours}`);
      allPass = false;
    } else if (totalWorkedHours !== tc.expectedWorkedHours) {
      console.error(`  ❌ Failed totalWorkedHours. Got ${totalWorkedHours}, expected ${tc.expectedWorkedHours}`);
      allPass = false;
    } else {
      console.log(`  ✅ Passed simulation`);
    }
  }

  if (allPass) {
    console.log('\n🎉 All holiday billing tests passed successfully!');
  } else {
    console.error('\n💥 Some test cases failed. Please review the output.');
    process.exit(1);
  }
}

runTest();
