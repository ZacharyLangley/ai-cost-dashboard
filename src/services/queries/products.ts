import { and, eq, sql } from 'drizzle-orm';
import { db as defaultDb } from '../../db/client.js';
import type { DrizzleDb } from '../../db/client.js';
import {
  ghUsageFacts,
  ghMetricsDaily,
  identityMap,
  m365UsageFacts,
  m365AppActivity,
} from '../../db/schema/index.js';
import { currentMonth } from '../../api/schemas/common.js';

export async function githubModels(
  month?: string,
  db: DrizzleDb = defaultDb,
) {
  const m = month ?? currentMonth();
  return db
    .select({
      model: ghUsageFacts.model,
      totalCost: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)`,
      totalQty: sql<number>`COALESCE(SUM(${ghUsageFacts.netQty}), 0)`,
      userCount: sql<number>`COUNT(DISTINCT ${ghUsageFacts.username})`,
    })
    .from(ghUsageFacts)
    .where(eq(ghUsageFacts.billingMonth, m))
    .groupBy(ghUsageFacts.model)
    .orderBy(sql`SUM(${ghUsageFacts.netAmount}) DESC`);
}

export async function acceptanceVsCost(
  month?: string,
  db: DrizzleDb = defaultDb,
) {
  const m = month ?? currentMonth();

  const usageRows = await db
    .select({
      username: ghUsageFacts.username,
      displayName: sql<string>`COALESCE(MIN(${identityMap.displayName}), ${ghUsageFacts.username})`,
      team: sql<string>`COALESCE(MIN(${identityMap.team}), 'Unmapped')`,
      completionsCost: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)`,
    })
    .from(ghUsageFacts)
    .leftJoin(identityMap, eq(identityMap.ghUsername, ghUsageFacts.username))
    .where(eq(ghUsageFacts.billingMonth, m))
    .groupBy(ghUsageFacts.username);

  const metricsRows = await db
    .select({
      username: ghMetricsDaily.username,
      suggestions: sql<number>`COALESCE(SUM(${ghMetricsDaily.suggestions}), 0)`,
      acceptances: sql<number>`COALESCE(SUM(${ghMetricsDaily.acceptances}), 0)`,
    })
    .from(ghMetricsDaily)
    .where(eq(ghMetricsDaily.feature, 'completions'))
    .groupBy(ghMetricsDaily.username);

  const metricsMap = new Map(metricsRows.map((r) => [r.username, r]));

  return usageRows.map((u) => {
    const m = metricsMap.get(u.username);
    const suggestions = m?.suggestions ?? 0;
    const acceptances = m?.acceptances ?? 0;
    return {
      username: u.username,
      displayName: u.displayName,
      team: u.team,
      completionsCost: u.completionsCost,
      // Note: cost is total GH usage, not completions-scoped (SKU not distinguished in seed)
      acceptanceRate: suggestions > 0 ? acceptances / suggestions : null,
    };
  });
}

export async function m365AdoptionHeatmap(db: DrizzleDb = defaultDb) {
  const [pullRow] = await db
    .select({ date: sql<string>`MAX(${m365UsageFacts.pullDate})` })
    .from(m365UsageFacts);
  if (!pullRow?.date) return [];

  const users = await db
    .select({
      upn: m365UsageFacts.upn,
      displayName: sql<string>`COALESCE(${identityMap.displayName}, ${m365UsageFacts.upn})`,
      team: sql<string>`COALESCE(${identityMap.team}, 'Unmapped')`,
    })
    .from(m365UsageFacts)
    .leftJoin(identityMap, eq(identityMap.m365Upn, m365UsageFacts.upn))
    .where(eq(m365UsageFacts.pullDate, pullRow.date));

  const activities = await db
    .select()
    .from(m365AppActivity)
    .where(eq(m365AppActivity.pullDate, pullRow.date));

  const actMap = new Map<string, Map<string, string | null>>();
  for (const a of activities) {
    if (!actMap.has(a.upn)) actMap.set(a.upn, new Map());
    actMap.get(a.upn)!.set(a.app, a.lastActive);
  }

  const APPS = ['teams', 'word', 'excel', 'powerpoint', 'outlook', 'chat'] as const;

  return users.map((u) => {
    const apps: Record<string, string | null> = {};
    const userApps = actMap.get(u.upn);
    for (const app of APPS) {
      apps[app] = userApps?.get(app) ?? null;
    }
    return { upn: u.upn, displayName: u.displayName, team: u.team, apps };
  });
}

export async function m365Breadth(db: DrizzleDb = defaultDb) {
  const [pullRow] = await db
    .select({ date: sql<string>`MAX(${m365UsageFacts.pullDate})` })
    .from(m365UsageFacts);
  if (!pullRow?.date) return [];

  const rows = await db
    .select({
      upn: m365UsageFacts.upn,
      displayName: sql<string>`COALESCE(${identityMap.displayName}, ${m365UsageFacts.upn})`,
      team: sql<string>`COALESCE(${identityMap.team}, 'Unmapped')`,
      appCount: sql<number>`COUNT(DISTINCT ${m365AppActivity.app})`,
      apps: sql<string>`GROUP_CONCAT(DISTINCT ${m365AppActivity.app})`,
    })
    .from(m365UsageFacts)
    .leftJoin(identityMap, eq(identityMap.m365Upn, m365UsageFacts.upn))
    .leftJoin(
      m365AppActivity,
      and(
        eq(m365AppActivity.upn, m365UsageFacts.upn),
        eq(m365AppActivity.pullDate, m365UsageFacts.pullDate),
      ),
    )
    .where(eq(m365UsageFacts.pullDate, pullRow.date))
    .groupBy(m365UsageFacts.upn)
    .orderBy(sql`COUNT(DISTINCT ${m365AppActivity.app}) DESC`);

  return rows.map((r) => ({
    upn: r.upn,
    displayName: r.displayName,
    team: r.team,
    appCount: r.appCount,
    apps: r.apps ? r.apps.split(',') : [],
  }));
}
