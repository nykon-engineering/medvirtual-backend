/**
 * sync-email-templates-to-prod.ts
 *
 * Mirrors the EmailTemplate table from the dev database into the prod
 * database: creates missing rows, updates editorial content on existing
 * rows (matched by key + business_unit), and deletes prod rows whose
 * key + business_unit no longer exists in dev.
 *
 * Does NOT touch EmailTemplateHistory, and does not copy created_at,
 * updated_at, or updated_by — prod keeps its own audit metadata.
 *
 * Dry-run by default: prints the plan without writing anything.
 * Pass --apply to actually write the changes.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register prisma/sync-email-templates-to-prod.ts
 *   npx ts-node -r tsconfig-paths/register prisma/sync-email-templates-to-prod.ts --apply
 */

import { EmailTemplate, Prisma, PrismaClient } from '@prisma/client';

const devPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});
const prodPrisma = new PrismaClient({
  datasources: { db: { url: process.env.PROD_DATABASE_URL } },
});

const CONTENT_FIELDS = [
  'name',
  'description',
  'subject',
  'headline',
  'body',
  'button_label',
  'button_url',
  'category',
  'functionality',
  'placeholders',
  'is_active',
] as const;

function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}

function contentOf(t: EmailTemplate) {
  return {
    ...pick(t, CONTENT_FIELDS),
    placeholders: (t.placeholders ?? []) as Prisma.InputJsonValue,
  };
}

function keyOf(t: Pick<EmailTemplate, 'key' | 'business_unit'>): string {
  return `${t.key}::${t.business_unit ?? 'null'}`;
}

async function main() {
  const apply = process.argv.includes('--apply');

  const [devTemplates, prodTemplates] = await Promise.all([
    devPrisma.emailTemplate.findMany(),
    prodPrisma.emailTemplate.findMany(),
  ]);

  const prodByKey = new Map(prodTemplates.map((t) => [keyOf(t), t]));
  const devKeys = new Set(devTemplates.map(keyOf));

  const toCreate = devTemplates.filter((t) => !prodByKey.has(keyOf(t)));
  const toUpdate = devTemplates.filter((t) => prodByKey.has(keyOf(t)));
  const toDelete = prodTemplates.filter((t) => !devKeys.has(keyOf(t)));

  console.log(`\n📋 Sync plan (dev → prod)\n`);
  console.log(`  Create (${toCreate.length}):`);
  toCreate.forEach((t) => console.log(`    + ${keyOf(t)}`));
  console.log(`  Update (${toUpdate.length}):`);
  toUpdate.forEach((t) => console.log(`    ~ ${keyOf(t)}`));
  console.log(`  Delete (${toDelete.length}):`);
  toDelete.forEach((t) => console.log(`    - ${keyOf(t)}`));

  if (!apply) {
    console.log(
      '\n🔎 Dry-run only. Re-run with --apply to write these changes to prod.\n',
    );
    return;
  }

  const operations = [
    ...toDelete.map((t) =>
      prodPrisma.emailTemplate.delete({ where: { id: t.id } }),
    ),
    ...toUpdate.map((t) => {
      const existing = prodByKey.get(keyOf(t))!;
      return prodPrisma.emailTemplate.update({
        where: { id: existing.id },
        data: contentOf(t),
      });
    }),
    ...toCreate.map((t) =>
      prodPrisma.emailTemplate.create({
        data: {
          key: t.key,
          business_unit: t.business_unit,
          ...contentOf(t),
        },
      }),
    ),
  ];

  await prodPrisma.$transaction(operations);

  console.log('\n✅ Prod EmailTemplate table synced with dev.\n');
  const total = await prodPrisma.emailTemplate.count();
  console.log(`📊 Total EmailTemplate rows in prod: ${total}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await devPrisma.$disconnect();
    await prodPrisma.$disconnect();
  });
