import { PrismaClient } from '@prisma/client';

async function main() {
  const prod = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });
  const staging = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

  const candidates = await prod.candidate.findMany({
    where: {
      avatar_url: { not: null },
      pipeline_status: { in: ['261075105', '1087596819'] }, // Available Candidates | Available Candidates - Part Time
    },
    select: { hubspot_id: true, avatar_url: true },
    orderBy: { id: 'desc' },
  });

  console.log(`Found ${candidates.length} candidates with avatar in prod`);

  let updated = 0;
  let skipped = 0;

  for (const { hubspot_id, avatar_url } of candidates) {
    try {
      await staging.candidate.update({
        where: { hubspot_id, avatar_url: null },
        data: { avatar_url },
      });
      updated++;
    } catch {
      skipped++;
    }
  }

  console.log(`Updated: ${updated} | Skipped: ${skipped}`);

  await prod.$disconnect();
  await staging.$disconnect();
}

main().catch(console.error);
