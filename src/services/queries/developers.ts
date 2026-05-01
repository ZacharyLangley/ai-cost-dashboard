import { and, eq, gte, sql } from 'drizzle-orm';
import { db as defaultDb } from '../../db/client.js';
import type { DrizzleDb } from '../../db/client.js';
import {
  ghUsageFacts,
  ghSeats,
  ghMetricsDaily,
  identityMap,
  m365AppActivity,
  m365UsageFacts,
} from '../../db/schema/index.js';
import { NotFoundError } from '../../lib/errors.js';
import { currentMonth, monthsAgo } from '../../api/schemas/common.js';

export interface DeveloperSummary {
  username: string;
  displayName: string;
  team: string;
  ghUsageCost: number;
  ghSeatCost: number;
  m365SeatCost: number;
  totalCost: number;
  totalRequests: number;
  modelCount: number;
  lastActivityAt: string | null;
  daysIdle: number | null;
}

export async function listDevelopers(
  opts: { month?: string; team?: string; sort?: string },
  db: DrizzleDb = defaultDb,
): Promise<DeveloperSummary[]> {
  const month = opts.month ?? currentMonth();

  const usageRows = await db
    .select({
      username: ghUsageFacts.username,
      displayName: sql<string>`COALESCE(MIN(${identityMap.displayName}), ${ghUsageFacts.username})`,
      team: sql<string>`COALESCE(MIN(${identityMap.team}), 'Unmapped')`,
      ghUsageCost: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)`,
      totalRequests: sql<number>`COALESCE(SUM(${ghUsageFacts.netQty}), 0)`,
      modelCount: sql<number>`COUNT(DISTINCT ${ghUsageFacts.model})`,
    })
    .from(ghUsageFacts)
    .leftJoin(identityMap, eq(identityMap.ghUsername, ghUsageFacts.username))
    .where(
      and(
        eq(ghUsageFacts.billingMonth, month),
        opts.team ? eq(identityMap.team, opts.team) : undefined,
      ),
    )
    .groupBy(ghUsageFacts.username);

  // Latest seat snapshot
  const [snapRow] = await db
    .select({ date: sql<string>`MAX(${ghSeats.snapshotDate})` })
    .from(ghSeats);
  const snapDate = snapRow?.date ?? null;

  const seatMap = new Map<string, { seatCostUsd: number; lastActivityAt: string | null }>();
  if (snapDate) {
    const seats = await db
      .select({
        username: ghSeats.username,
        seatCostUsd: ghSeats.seatCostUsd,
        lastActivityAt: ghSeats.lastActivityAt,
      })
      .from(ghSeats)
      .where(eq(ghSeats.snapshotDate, snapDate));
    for (const s of seats) seatMap.set(s.username, s);
  }

  // Latest M365 pull
  const [m365Row] = await db
    .select({ date: sql<string>`MAX(${m365UsageFacts.pullDate})` })
    .from(m365UsageFacts);
  const m365PullDate = m365Row?.date ?? null;

  const m365Map = new Map<string, number>(); // upn → seat cost
  if (m365PullDate) {
    const m365Rows = await db
      .select({ upn: m365UsageFacts.upn, seatCostUsd: m365UsageFacts.seatCostUsd })
      .from(m365UsageFacts)
      .where(eq(m365UsageFacts.pullDate, m365PullDate));
    for (const r of m365Rows) m365Map.set(r.upn, r.seatCostUsd);
  }

  // Identity map for UPN lookup
  const identities = await db.select().from(identityMap);
  const upnByGh = new Map(identities.map((i) => [i.ghUsername ?? '', i.m365Upn ?? '']));

  const now = Date.now();
  const results: DeveloperSummary[] = usageRows.map((row) => {
    const seat = seatMap.get(row.username);
    const upn = upnByGh.get(row.username) ?? '';
    const m365SeatCost = m365Map.get(upn) ?? 0;
    const ghSeatCost = seat?.seatCostUsd ?? 0;
    const lastActivityAt = seat?.lastActivityAt ?? null;
    const daysIdle = lastActivityAt
      ? Math.floor((now - new Date(lastActivityAt).getTime()) / 86_400_000)
      : null;

    return {
      username: row.username,
      displayName: row.displayName,
      team: row.team,
      ghUsageCost: row.ghUsageCost,
      ghSeatCost,
      m365SeatCost,
      totalCost: row.ghUsageCost + ghSeatCost + m365SeatCost,
      totalRequests: row.totalRequests,
      modelCount: row.modelCount,
      lastActivityAt,
      daysIdle,
    };
  });

  if (opts.sort === 'name') return results.sort((a, b) => a.displayName.localeCompare(b.displayName));
  if (opts.sort === 'acceptance') return results; // acceptance sort requires metrics join — return as-is
  return results.sort((a, b) => b.totalCost - a.totalCost);
}

export async function getDeveloper(
  username: string,
  months = 6,
  db: DrizzleDb = defaultDb,
) {
  const identities = await db
    .select()
    .from(identityMap)
    .where(eq(identityMap.ghUsername, username))
    .limit(1);

  const anyUsage = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(ghUsageFacts)
    .where(eq(ghUsageFacts.username, username));

  if (!identities.length && !anyUsage[0]?.c) {
    throw new NotFoundError(`Developer ${username}`);
  }

  const identity = identities[0] ?? null;
  const startMonth = monthsAgo(months);

  const monthly = await db
    .select({
      billingMonth: ghUsageFacts.billingMonth,
      cost: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)`,
      requests: sql<number>`COALESCE(SUM(${ghUsageFacts.netQty}), 0)`,
    })
    .from(ghUsageFacts)
    .where(and(eq(ghUsageFacts.username, username), gte(ghUsageFacts.billingMonth, startMonth)))
    .groupBy(ghUsageFacts.billingMonth)
    .orderBy(ghUsageFacts.billingMonth);

  const modelMix = await db
    .select({
      model: ghUsageFacts.model,
      cost: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)`,
      requests: sql<number>`COALESCE(SUM(${ghUsageFacts.netQty}), 0)`,
    })
    .from(ghUsageFacts)
    .where(eq(ghUsageFacts.username, username))
    .groupBy(ghUsageFacts.model)
    .orderBy(sql`SUM(${ghUsageFacts.netAmount}) DESC`);

  const [metrics] = await db
    .select({
      suggestions: sql<number>`COALESCE(SUM(${ghMetricsDaily.suggestions}), 0)`,
      acceptances: sql<number>`COALESCE(SUM(${ghMetricsDaily.acceptances}), 0)`,
    })
    .from(ghMetricsDaily)
    .where(eq(ghMetricsDaily.username, username));

  const suggestions = metrics?.suggestions ?? 0;
  const acceptances = metrics?.acceptances ?? 0;
  const acceptanceRate = suggestions > 0 ? acceptances / suggestions : null;

  const [snapRow] = await db
    .select({ date: sql<string>`MAX(${ghSeats.snapshotDate})` })
    .from(ghSeats);
  const seat = snapRow?.date
    ? (
        await db
          .select()
          .from(ghSeats)
          .where(and(eq(ghSeats.snapshotDate, snapRow.date), eq(ghSeats.username, username)))
          .limit(1)
      )[0] ?? null
    : null;

  const [m365PullRow] = await db
    .select({ date: sql<string>`MAX(${m365AppActivity.pullDate})` })
    .from(m365AppActivity);
  const m365Apps =
    m365PullRow?.date && identity?.m365Upn
      ? await db
          .select()
          .from(m365AppActivity)
          .where(
            and(
              eq(m365AppActivity.pullDate, m365PullRow.date),
              eq(m365AppActivity.upn, identity.m365Upn),
            ),
          )
      : [];

  const lastActivityAt = seat?.lastActivityAt ?? null;
  const daysIdle = lastActivityAt
    ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / 86_400_000)
    : null;

  return {
    identity: identity ?? { ghUsername: username, displayName: username, team: 'Unmapped', m365Upn: null },
    monthly,
    modelMix,
    acceptanceRate,
    m365Apps: m365Apps.map((a) => ({ app: a.app, lastActive: a.lastActive })),
    idle: { github: daysIdle !== null ? daysIdle > 30 : false, daysIdle },
  };
}
