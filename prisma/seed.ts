import { PrismaClient } from '@prisma/client';

const FLOOR_PRICE_HOURS_PER_MONTH = 176;

const floorPriceEnglish: Record<string, number> = {
  'Junior Medical Admin': 1800,
  'Junior Dental Admin': 1800,
  'Senior Medical Admin': 2200,
  'Senior Dental Admin': 2200,
  'Medical Nurse': 2820,
  'Medical Doctor (MD)': 2820,
  'Dental Nurse': 2820,
  'Dental Doctor (Dentist)': 2820,
  'Junior Medical Biller': 1800,
  'Junior Dental Biller': 1800,
  'Senior Medical Biller': 2200,
  'Senior Dental Biller': 2200,
  'Full Cycle Medical Biller': 2400,
  'Full Cycle Dental Biller': 2400,
  'Junior Med-Legal Case Coordinator': 2400,
  'Senior Med-Legal Case Coordinator': 2820,
  'Sales Development Representative (SDR)': 1800,
  'Sales Executive': 2200,
  'Sales and Account Manager': 2820,
  'Bookkeeper': 2400,
  'Marketing Assistant': 2990,
};

const floorPriceBilingual: Record<string, number> = {
  'Junior Medical Admin': 2000,
  'Junior Dental Admin': 2000,
  'Senior Medical Admin': 2400,
  'Senior Dental Admin': 2400,
  'Medical Nurse': 2990,
  'Medical Doctor (MD)': 2990,
  'Dental Nurse': 2990,
  'Dental Doctor (Dentist)': 2990,
  'Junior Medical Biller': 2000,
  'Junior Dental Biller': 2000,
  'Senior Medical Biller': 2400,
  'Senior Dental Biller': 2400,
  'Full Cycle Medical Biller': 2640,
  'Full Cycle Dental Biller': 2640,
  'Junior Med-Legal Case Coordinator': 2640,
  'Senior Med-Legal Case Coordinator': 2990,
  'Sales Development Representative (SDR)': 2000,
  'Sales Executive': 2400,
  'Sales and Account Manager': 2990,
  'Bookkeeper': 2640,
  'Marketing Assistant': 3240,
};

const prisma = new PrismaClient();

async function main() {
  // Seed PositionRateConfig from dictionaries
  const allPositions = new Set([
    ...Object.keys(floorPriceEnglish),
    ...Object.keys(floorPriceBilingual),
  ]);

  for (const position of allPositions) {
    const floorPriceEnglishHourly =
      floorPriceEnglish[position] !== undefined
        ? floorPriceEnglish[position] / FLOOR_PRICE_HOURS_PER_MONTH
        : null;
    const floorPriceBilingualHourly =
      floorPriceBilingual[position] !== undefined
        ? floorPriceBilingual[position] / FLOOR_PRICE_HOURS_PER_MONTH
        : null;
    await prisma.positionRateConfig.upsert({
      where: { position },
      update: {},
      create: {
        position,
        floor_price_english: floorPriceEnglishHourly,
        floor_price_bilingual: floorPriceBilingualHourly,
        hourly_rate_english: null,
        hourly_rate_bilingual: null,
        margin_per_hour: null,
      },
    });
  }

  console.log(`💰 PositionRateConfig seeded: ${allPositions.size} positions`);

  console.log('✅ PositionRateConfig seeding completed successfully!');
  console.log(`- Position rate configs: ${await prisma.positionRateConfig.count()}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
