import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

async function backfill() {
  const invoices = await prisma.invoice.findMany({
    where: { 
      OR: [
        { reference: null },
        { reference: '' }
      ]
    }
  });

  console.log(`🚀 Found ${invoices.length} invoices to backfill.`);

  for (const invoice of invoices) {
    const text = Math.random().toString(36).substring(2, 7).toUpperCase();
    const dateVal = DateTime.fromJSDate(invoice.createdAt).toFormat("yyyyLLdd-hh-mm");
    const reference = `${dateVal}-${text}`;

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { reference }
    });
    console.log(`✅ Updated invoice ${invoice.id} with reference ${reference}`);
  }

  console.log('🎉 Backfill completed.');
}

backfill()
  .catch(e => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
