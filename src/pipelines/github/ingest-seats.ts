import { db as defaultDb } from '../../db/client.js';
import type { DrizzleDb } from '../../db/client.js';
import { ghSeats } from '../../db/schema/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { fetchAllSeats } from '../../services/github/seats.js';

export async function ingestSeats(db: DrizzleDb = defaultDb): Promise<{ rowsAffected: number }> {
  if (!env.GITHUB_ORG) {
    logger.warn('GITHUB_ORG not configured, skipping seats ingest');
    return { rowsAffected: 0 };
  }

  const snapshotDate = new Date().toISOString().split('T')[0]!;
  const seats = await fetchAllSeats(env.GITHUB_ORG);

  let rows = 0;
  for (const seat of seats) {
    await db
      .insert(ghSeats)
      .values({
        snapshotDate,
        username: seat.assignee.login,
        planType: seat.plan_type,
        seatCostUsd: env.GH_SEAT_COST_USD,
        lastActivityAt: seat.last_activity_at ?? null,
        assigneeTeam: seat.assigning_team?.slug ?? null,
      })
      .onConflictDoUpdate({
        target: [ghSeats.snapshotDate, ghSeats.username],
        set: {
          planType: seat.plan_type,
          seatCostUsd: env.GH_SEAT_COST_USD,
          lastActivityAt: seat.last_activity_at ?? null,
          assigneeTeam: seat.assigning_team?.slug ?? null,
        },
      });
    rows++;
  }

  logger.info({ snapshotDate, rows }, 'seats ingest complete');
  return { rowsAffected: rows };
}
