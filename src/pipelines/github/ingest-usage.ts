import { db as defaultDb } from '../../db/client.js';
import type { DrizzleDb } from '../../db/client.js';
import { rawGhUsage, ghUsageFacts } from '../../db/schema/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { fetchMonthlyUsage } from '../../services/github/usage.js';
import { usageResponseSchema } from '../../services/github/schemas.js';
import { logDrift } from '../pipeline-runs.js';

const KNOWN_UNIT_TYPES = ['requests', 'tokens'] as const;

async function ingestMonth(
  org: string,
  year: number,
  month: number,
  db: DrizzleDb,
): Promise<number> {
  const pullDate = new Date().toISOString().split('T')[0]!;
  const billingMonth = `${year}-${String(month).padStart(2, '0')}`;

  const raw = await fetchMonthlyUsage(org, year, month);

  await db
    .insert(rawGhUsage)
    .values({ pullDate, billingMonth, payload: JSON.stringify(raw) })
    .onConflictDoUpdate({
      target: [rawGhUsage.pullDate, rawGhUsage.billingMonth],
      set: { payload: JSON.stringify(raw) },
    });

  const parsed = usageResponseSchema.safeParse(raw);
  if (!parsed.success) {
    await logDrift(
      'github:usage',
      'response',
      undefined,
      JSON.stringify(raw).substring(0, 500),
      db,
    );
    logger.warn({ billingMonth }, 'usage response failed schema validation');
    return 0;
  }

  let rows = 0;
  for (const item of parsed.data.usageItems) {
    // [SPECULATION] user field on each item when called without user filter
    const username = item.user ?? '__aggregate__';

    if (!KNOWN_UNIT_TYPES.includes(item.unitType as (typeof KNOWN_UNIT_TYPES)[number])) {
      await logDrift(
        'github:usage',
        'unitType',
        item.unitType,
        JSON.stringify(item).substring(0, 200),
        db,
      );
    }

    await db
      .insert(ghUsageFacts)
      .values({
        billingMonth,
        username,
        product: item.product,
        sku: item.sku,
        model: item.model,
        unitType: item.unitType,
        pricePerUnit: item.pricePerUnit,
        grossQty: item.grossQuantity,
        grossAmount: item.grossAmount,
        discountQty: item.discountQuantity,
        discountAmount: item.discountAmount,
        netQty: item.netQuantity,
        netAmount: item.netAmount,
        pulledAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [ghUsageFacts.billingMonth, ghUsageFacts.username, ghUsageFacts.sku, ghUsageFacts.model],
        set: {
          unitType: item.unitType,
          pricePerUnit: item.pricePerUnit,
          grossQty: item.grossQuantity,
          grossAmount: item.grossAmount,
          discountQty: item.discountQuantity,
          discountAmount: item.discountAmount,
          netQty: item.netQuantity,
          netAmount: item.netAmount,
          pulledAt: new Date().toISOString(),
        },
      });
    rows++;
  }

  logger.info({ billingMonth, rows }, 'usage ingest complete');
  return rows;
}

export async function ingestUsage(db: DrizzleDb = defaultDb): Promise<{ rowsAffected: number }> {
  if (!env.GITHUB_ORG) {
    logger.warn('GITHUB_ORG not configured, skipping usage ingest');
    return { rowsAffected: 0 };
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const [curr, prev] = await Promise.all([
    ingestMonth(env.GITHUB_ORG, currentYear, currentMonth, db),
    ingestMonth(env.GITHUB_ORG, prevYear, prevMonth, db),
  ]);

  return { rowsAffected: curr + prev };
}
