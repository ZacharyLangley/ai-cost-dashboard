import { eq, sql } from 'drizzle-orm';
import { db as defaultDb } from '../../db/client.js';
import type { DrizzleDb } from '../../db/client.js';
import { ghUsageFacts, identityMap, ghSeats, m365UsageFacts } from '../../db/schema/index.js';
import { NotFoundError } from '../../lib/errors.js';
import { currentMonth, monthsAgo } from '../../api/schemas/common.js';
import { listDevelopers } from './developers.js';

export interface TeamSummary {
  team: string;
  devCount: number;
  ghUsageCost: number;
  totalCost: number;
}

export async function listTeams(
  opts: { month?: string },
  db: DrizzleDb = defaultDb,
): Promise<TeamSummary[]> {
  const month = opts.month ?? currentMonth();

  const rows = await db
    .select({
      team: sql<string>`COALESCE(${identityMap.team}, 'Unmapped')`,
      devCount: sql<number>`COUNT(DISTINCT ${ghUsageFacts.username})`,
      ghUsageCost: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)`,
    })
    .from(ghUsageFacts)
    .leftJoin(identityMap, eq(identityMap.ghUsername, ghUsageFacts.username))
    .where(eq(ghUsageFacts.billingMonth, month))
    .groupBy(sql`COALESCE(${identityMap.team}, 'Unmapped')`);

  // Add seat costs per team
  const [snapRow] = await db
    .select({ date: sql<string>`MAX(${ghSeats.snapshotDate})` })
    .from(ghSeats);
  const [m365Row] = await db
    .select({ date: sql<string>`MAX(${m365UsageFacts.pullDate})` })
    .from(m365UsageFacts);

  const ghSeatByTeam = new Map<string, number>();
  if (snapRow?.date) {
    const seatRows = await db
      .select({
        team: sql<string>`COALESCE(${identityMap.team}, 'Unmapped')`,
        cost: sql<number>`COALESCE(SUM(${ghSeats.seatCostUsd}), 0)`,
      })
      .from(ghSeats)
      .leftJoin(identityMap, eq(identityMap.ghUsername, ghSeats.username))
      .where(eq(ghSeats.snapshotDate, snapRow.date))
      .groupBy(sql`COALESCE(${identityMap.team}, 'Unmapped')`);
    for (const r of seatRows) ghSeatByTeam.set(r.team, r.cost);
  }

  const m365ByTeam = new Map<string, number>();
  if (m365Row?.date) {
    const m365Rows = await db
      .select({
        team: sql<string>`COALESCE(${identityMap.team}, 'Unmapped')`,
        cost: sql<number>`COALESCE(SUM(${m365UsageFacts.seatCostUsd}), 0)`,
      })
      .from(m365UsageFacts)
      .leftJoin(identityMap, eq(identityMap.m365Upn, m365UsageFacts.upn))
      .where(eq(m365UsageFacts.pullDate, m365Row.date))
      .groupBy(sql`COALESCE(${identityMap.team}, 'Unmapped')`);
    for (const r of m365Rows) m365ByTeam.set(r.team, r.cost);
  }

  return rows
    .map((r) => ({
      team: r.team,
      devCount: r.devCount,
      ghUsageCost: r.ghUsageCost,
      totalCost: r.ghUsageCost + (ghSeatByTeam.get(r.team) ?? 0) + (m365ByTeam.get(r.team) ?? 0),
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

export async function getTeam(
  teamName: string,
  months = 6,
  db: DrizzleDb = defaultDb,
) {
  // Check team exists in identity_map (not current-month-dependent)
  const exists = await db
    .select({ id: identityMap.id })
    .from(identityMap)
    .where(eq(identityMap.team, teamName))
    .limit(1);
  if (!exists.length) throw new NotFoundError(`Team ${teamName}`);

  const startMonth = monthsAgo(months);

  const monthly = await db
    .select({
      billingMonth: ghUsageFacts.billingMonth,
      cost: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)`,
      devCount: sql<number>`COUNT(DISTINCT ${ghUsageFacts.username})`,
    })
    .from(ghUsageFacts)
    .leftJoin(identityMap, eq(identityMap.ghUsername, ghUsageFacts.username))
    .where(sql`COALESCE(${identityMap.team}, 'Unmapped') = ${teamName} AND ${ghUsageFacts.billingMonth} >= ${startMonth}`)
    .groupBy(ghUsageFacts.billingMonth)
    .orderBy(ghUsageFacts.billingMonth);

  const developers = await listDevelopers({ team: teamName }, db);

  const topModels = await db
    .select({
      model: ghUsageFacts.model,
      cost: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)`,
      requests: sql<number>`COALESCE(SUM(${ghUsageFacts.netQty}), 0)`,
    })
    .from(ghUsageFacts)
    .leftJoin(identityMap, eq(identityMap.ghUsername, ghUsageFacts.username))
    .where(sql`COALESCE(${identityMap.team}, 'Unmapped') = ${teamName}`)
    .groupBy(ghUsageFacts.model)
    .orderBy(sql`SUM(${ghUsageFacts.netAmount}) DESC`)
    .limit(5);

  return { monthly, developers, topModels };
}
