import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db as defaultDb } from '../../db/client.js';
import type { DrizzleDb } from '../../db/client.js';
import {
  ghUsageFacts,
  ghSeats,
  m365UsageFacts,
  identityMap,
} from '../../db/schema/index.js';
import { currentMonth, monthsAgo } from '../../api/schemas/common.js';

const IDLE_DAYS = 30;

export async function getOrgSummary(db: DrizzleDb = defaultDb) {
  const month = currentMonth();

  const [ghUsage] = await db
    .select({ total: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)` })
    .from(ghUsageFacts)
    .where(eq(ghUsageFacts.billingMonth, month));

  const [snapRow] = await db
    .select({ date: sql<string>`MAX(${ghSeats.snapshotDate})` })
    .from(ghSeats);

  const [ghSeat] = snapRow?.date
    ? await db
        .select({
          total: sql<number>`COALESCE(SUM(${ghSeats.seatCostUsd}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(ghSeats)
        .where(eq(ghSeats.snapshotDate, snapRow.date))
    : [{ total: 0, count: 0 }];

  const [m365Row] = await db
    .select({ date: sql<string>`MAX(${m365UsageFacts.pullDate})` })
    .from(m365UsageFacts);

  const [m365Seat] = m365Row?.date
    ? await db
        .select({
          total: sql<number>`COALESCE(SUM(${m365UsageFacts.seatCostUsd}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(m365UsageFacts)
        .where(eq(m365UsageFacts.pullDate, m365Row.date))
    : [{ total: 0, count: 0 }];

  // Active devs: seat with activity in last IDLE_DAYS days
  const idleThreshold = new Date();
  idleThreshold.setUTCDate(idleThreshold.getUTCDate() - IDLE_DAYS);
  const thresholdStr = idleThreshold.toISOString();

  const [ghIdleRow] = snapRow?.date
    ? await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(ghSeats)
        .where(
          and(
            eq(ghSeats.snapshotDate, snapRow.date),
            or(isNull(ghSeats.lastActivityAt), sql`${ghSeats.lastActivityAt} < ${thresholdStr}`),
          ),
        )
    : [{ count: 0 }];

  const [m365IdleRow] = m365Row?.date
    ? await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(m365UsageFacts)
        .where(
          and(
            eq(m365UsageFacts.pullDate, m365Row.date),
            or(
              isNull(m365UsageFacts.lastActivity),
              sql`${m365UsageFacts.daysSinceActive} > ${IDLE_DAYS}`,
            ),
          ),
        )
    : [{ count: 0 }];

  // Unmapped developers (in usage facts but not in identity_map)
  const [unmappedRow] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${ghUsageFacts.username})` })
    .from(ghUsageFacts)
    .leftJoin(identityMap, eq(identityMap.ghUsername, ghUsageFacts.username))
    .where(and(eq(ghUsageFacts.billingMonth, month), isNull(identityMap.id)));

  const ghSeatTotal = ghSeat?.total ?? 0;
  const m365SeatTotal = m365Seat?.total ?? 0;
  const ghUsageTotal = ghUsage?.total ?? 0;

  return {
    totalCostMonth: ghUsageTotal + ghSeatTotal + m365SeatTotal,
    breakdown: {
      ghSeats: ghSeatTotal,
      ghUsage: ghUsageTotal,
      m365Seats: m365SeatTotal,
    },
    activeDevs: (ghSeat?.count ?? 0) - (ghIdleRow?.count ?? 0),
    idleSeats: {
      github: ghIdleRow?.count ?? 0,
      m365: m365IdleRow?.count ?? 0,
    },
    unmappedCount: unmappedRow?.count ?? 0,
  };
}

export async function getIdleSeats(
  product: 'github' | 'm365' | undefined,
  db: DrizzleDb = defaultDb,
) {
  const idleThreshold = new Date();
  idleThreshold.setUTCDate(idleThreshold.getUTCDate() - IDLE_DAYS);
  const thresholdStr = idleThreshold.toISOString();

  const results: {
    username: string;
    displayName: string | null;
    team: string | null;
    product: string;
    seatCostUsd: number;
    lastActivityAt: string | null;
    daysIdle: number | null;
  }[] = [];

  if (!product || product === 'github') {
    const [snapRow] = await db
      .select({ date: sql<string>`MAX(${ghSeats.snapshotDate})` })
      .from(ghSeats);
    if (snapRow?.date) {
      const rows = await db
        .select({
          username: ghSeats.username,
          displayName: identityMap.displayName,
          team: identityMap.team,
          seatCostUsd: ghSeats.seatCostUsd,
          lastActivityAt: ghSeats.lastActivityAt,
        })
        .from(ghSeats)
        .leftJoin(identityMap, eq(identityMap.ghUsername, ghSeats.username))
        .where(
          and(
            eq(ghSeats.snapshotDate, snapRow.date),
            or(isNull(ghSeats.lastActivityAt), sql`${ghSeats.lastActivityAt} < ${thresholdStr}`),
          ),
        );
      const now = Date.now();
      for (const r of rows) {
        results.push({
          username: r.username,
          displayName: r.displayName,
          team: r.team,
          product: 'github',
          seatCostUsd: r.seatCostUsd,
          lastActivityAt: r.lastActivityAt ?? null,
          daysIdle: r.lastActivityAt
            ? Math.floor((now - new Date(r.lastActivityAt).getTime()) / 86_400_000)
            : null,
        });
      }
    }
  }

  if (!product || product === 'm365') {
    const [m365Row] = await db
      .select({ date: sql<string>`MAX(${m365UsageFacts.pullDate})` })
      .from(m365UsageFacts);
    if (m365Row?.date) {
      const rows = await db
        .select({
          upn: m365UsageFacts.upn,
          displayName: identityMap.displayName,
          team: identityMap.team,
          seatCostUsd: m365UsageFacts.seatCostUsd,
          lastActivity: m365UsageFacts.lastActivity,
          daysSinceActive: m365UsageFacts.daysSinceActive,
        })
        .from(m365UsageFacts)
        .leftJoin(identityMap, eq(identityMap.m365Upn, m365UsageFacts.upn))
        .where(
          and(
            eq(m365UsageFacts.pullDate, m365Row.date),
            or(
              isNull(m365UsageFacts.lastActivity),
              sql`${m365UsageFacts.daysSinceActive} > ${IDLE_DAYS}`,
            ),
          ),
        );
      for (const r of rows) {
        results.push({
          username: r.upn,
          displayName: r.displayName,
          team: r.team,
          product: 'm365',
          seatCostUsd: r.seatCostUsd,
          lastActivityAt: r.lastActivity ?? null,
          daysIdle: r.daysSinceActive,
        });
      }
    }
  }

  return results.sort((a, b) => (b.daysIdle ?? 999) - (a.daysIdle ?? 999));
}

export async function getOrgTrend(
  months = 12,
  groupBy: 'product' | 'team' | 'model' = 'product',
  db: DrizzleDb = defaultDb,
) {
  const startMonth = monthsAgo(months);

  if (groupBy === 'model') {
    return db
      .select({
        period: ghUsageFacts.billingMonth,
        group: ghUsageFacts.model,
        cost: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)`,
      })
      .from(ghUsageFacts)
      .where(sql`${ghUsageFacts.billingMonth} >= ${startMonth}`)
      .groupBy(ghUsageFacts.billingMonth, ghUsageFacts.model)
      .orderBy(ghUsageFacts.billingMonth);
  }

  if (groupBy === 'team') {
    return db
      .select({
        period: ghUsageFacts.billingMonth,
        group: sql<string>`COALESCE(${identityMap.team}, 'Unmapped')`,
        cost: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)`,
      })
      .from(ghUsageFacts)
      .leftJoin(identityMap, eq(identityMap.ghUsername, ghUsageFacts.username))
      .where(sql`${ghUsageFacts.billingMonth} >= ${startMonth}`)
      .groupBy(ghUsageFacts.billingMonth, sql`COALESCE(${identityMap.team}, 'Unmapped')`)
      .orderBy(ghUsageFacts.billingMonth);
  }

  // groupBy=product: split GH usage vs seat costs
  const ghUsage = await db
    .select({
      period: ghUsageFacts.billingMonth,
      cost: sql<number>`COALESCE(SUM(${ghUsageFacts.netAmount}), 0)`,
    })
    .from(ghUsageFacts)
    .where(sql`${ghUsageFacts.billingMonth} >= ${startMonth}`)
    .groupBy(ghUsageFacts.billingMonth)
    .orderBy(ghUsageFacts.billingMonth);

  return ghUsage.map((r) => ({ period: r.period, group: 'GitHub Usage', cost: r.cost }));
}
