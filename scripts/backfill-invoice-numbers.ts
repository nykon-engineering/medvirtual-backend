import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0 && axios.isAxiosError(err) && err.response?.status === 429) {
      await sleep(delay);
      return retry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

async function main() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN is required');

  const prisma = new PrismaClient();

  const snapshots = await prisma.hubspotInvoiceSnapshot.findMany({
    where: { invoice_number: null },
    select: { id: true, hubspot_id: true },
  });

  console.log(`Found ${snapshots.length} snapshots with no invoice_number`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const snapshot of snapshots) {
    try {
      const response = await retry(() =>
        axios.get(
          `https://api.hubapi.com/crm/v3/objects/invoices/${snapshot.hubspot_id}?properties=hs_number`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      const hsNumber: string | null = response.data?.properties?.hs_number ?? null;

      if (!hsNumber) {
        console.log(`Invoice ${snapshot.hubspot_id}: hs_number is empty, skipping`);
        skipped++;
        continue;
      }

      await prisma.hubspotInvoiceSnapshot.update({
        where: { id: snapshot.id },
        data: { invoice_number: hsNumber },
      });

      console.log(`Invoice ${snapshot.hubspot_id}: updated invoice_number = ${hsNumber}`);
      updated++;
    } catch (err) {
      console.error(`Invoice ${snapshot.hubspot_id}: failed — ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped} failed=${failed}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
