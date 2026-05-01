import { and, gte, sql } from 'drizzle-orm';
import { db as defaultDb } from '../../db/client.js';
import type { DrizzleDb } from '../../db/client.js';
import { pipelineRuns, apiDriftLog, m365UsageFacts } from '../../db/schema/index.js';

export async function getPipelineStatus(db: DrizzleDb = defaultDb) {
  // Latest completed run per pipeline
  const allRuns = await db
    .select()
    .from(pipelineRuns)
    .orderBy(sql`${pipelineRuns.id} DESC`)
    .limit(50);

  const seen = new Set<string>();
  const latest: typeof allRuns = [];
  for (const run of allRuns) {
    if (!seen.has(run.pipeline)) {
      seen.add(run.pipeline);
      latest.push(run);
    }
  }

  return latest.map((r) => ({
    pipeline: r.pipeline,
    lastRun: r.finishedAt,
    status: r.status,
    rowsAffected: r.rowsAffected,
  }));
}

export async function getApiDrift(since?: string, db: DrizzleDb = defaultDb) {
  const rows = since
    ? await db
        .select()
        .from(apiDriftLog)
        .where(gte(apiDriftLog.detectedAt, since))
        .orderBy(sql`${apiDriftLog.detectedAt} DESC`)
        .limit(100)
    : await db
        .select()
        .from(apiDriftLog)
        .orderBy(sql`${apiDriftLog.detectedAt} DESC`)
        .limit(100);
  return rows;
}

export async function getHashingStatus(db: DrizzleDb = defaultDb) {
  const [row] = await db
    .select({
      upnIsHashed: m365UsageFacts.upnIsHashed,
      lastDetectedAt: sql<string>`MAX(${m365UsageFacts.pullDate})`,
    })
    .from(m365UsageFacts)
    .groupBy(m365UsageFacts.upnIsHashed)
    .orderBy(sql`MAX(${m365UsageFacts.pullDate}) DESC`)
    .limit(1);

  return {
    m365UpnHashed: row?.upnIsHashed ?? false,
    lastDetectedAt: row?.lastDetectedAt ?? null,
  };
}
