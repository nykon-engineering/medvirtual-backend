/**
 * Surgical update: registers {{candidateCards}} on the `offer-panel-created`
 * email template.
 *
 * Why not `npm run seed`: the seeder rewrites subject/headline/body/placeholders
 * for ALL ~50 templates from the file, discarding any edit a system user made
 * through the admin UI. This touches one key and nothing else.
 *
 * It is idempotent and preserves the CURRENT body — the placeholder is appended
 * to the existing copy rather than replacing it with the seed text, so a
 * customized template keeps its wording. Re-running it is a no-op.
 *
 * Run against one database at a time:
 *   DB=dev  npx ts-node prisma/add-candidate-cards-placeholder.ts
 *   DB=prod npx ts-node prisma/add-candidate-cards-placeholder.ts
 *   DB=dev  DRY_RUN=1 npx ts-node prisma/add-candidate-cards-placeholder.ts
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const TEMPLATE_KEY = 'offer-panel-created';
const PLACEHOLDER = '{{candidateCards}}';

const TARGETS: Record<string, string | undefined> = {
  dev: process.env.DATABASE_URL,
  prod: process.env.PROD_DATABASE_URL,
  local: process.env.LOCAL_DATABASE_URL,
};

/**
 * Inserts the placeholder on its own line before the closing paragraph, so the
 * cards land between the intro and the "review them" line. Falls back to
 * appending when the expected sentence isn't there (i.e. the copy was rewritten).
 */
function bodyWithPlaceholder(body: string): string {
  if (body.includes(PLACEHOLDER)) return body;

  const anchor = 'Review them at your convenience';
  const idx = body.indexOf(anchor);
  if (idx !== -1) {
    return `${body.slice(0, idx)}${PLACEHOLDER}\n${body.slice(idx)}`;
  }
  return `${body.trimEnd()}\n\n${PLACEHOLDER}`;
}

/**
 * The RDS instances drop connections intermittently from this network, so a
 * cold connect can fail even though the database is healthy. Retry rather than
 * leave the update half-applied across environments.
 */
async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < tries) {
        console.log(`  connection attempt ${attempt} failed, retrying...`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastError;
}

async function main() {
  const which = (process.env.DB ?? '').toLowerCase();
  const dryRun = process.env.DRY_RUN === '1';
  const url = TARGETS[which];

  if (!url) {
    console.error(
      `Set DB to one of: ${Object.keys(TARGETS).join(' | ')}  (got "${which || 'unset'}")`,
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const host = url.split('@')[1]?.split('/')[0] ?? 'unknown';
  console.log(`\nTarget: ${which.toUpperCase()} (${host})${dryRun ? '  [DRY RUN]' : ''}`);

  try {
    const rows = await withRetry(() =>
      prisma.emailTemplate.findMany({
        where: { key: TEMPLATE_KEY },
        select: {
          id: true,
          business_unit: true,
          body: true,
          placeholders: true,
        },
      }),
    );

    if (rows.length === 0) {
      console.log(`  No "${TEMPLATE_KEY}" row found — nothing to do.`);
      return;
    }

    for (const row of rows) {
      const label = row.business_unit ?? '(global)';
      const current = Array.isArray(row.placeholders)
        ? (row.placeholders as string[])
        : [];

      const nextPlaceholders = current.includes(PLACEHOLDER)
        ? current
        : [...current, PLACEHOLDER];
      const nextBody = bodyWithPlaceholder(row.body);

      const placeholdersChanged = nextPlaceholders.length !== current.length;
      const bodyChanged = nextBody !== row.body;

      if (!placeholdersChanged && !bodyChanged) {
        console.log(`  ${label}: already up to date.`);
        continue;
      }

      if (dryRun) {
        console.log(`  ${label}: WOULD update`);
        console.log(`     placeholders: ${placeholdersChanged ? 'add ' + PLACEHOLDER : 'unchanged'}`);
        console.log(`     body        : ${bodyChanged ? JSON.stringify(nextBody) : 'unchanged'}`);
        continue;
      }

      // Note: no EmailTemplateHistory snapshot is written. This is a schema-level
      // registration of a new placeholder, not an editorial change, and the
      // template's own history should reflect what humans wrote.
      await withRetry(() =>
        prisma.emailTemplate.update({
          where: { id: row.id },
          data: { placeholders: nextPlaceholders, body: nextBody },
        }),
      );
      console.log(`  ${label}: updated.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
