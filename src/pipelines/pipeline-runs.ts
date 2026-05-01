import { db as defaultDb } from '../db/client.js';
import type { DrizzleDb } from '../db/client.js';
import { pipelineRuns, apiDriftLog } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export async function startPipelineRun(pipeline: string, db: DrizzleDb = defaultDb): Promise<number> {
  const result = await db
    .insert(pipelineRuns)
    .values({ pipeline, startedAt: new Date().toISOString(), status: 'running' })
    .returning({ id: pipelineRuns.id });
  return result[0].id;
}

export async function finishPipelineRun(
  id: number,
  status: 'success' | 'failed',
  err?: unknown,
  db: DrizzleDb = defaultDb,
): Promise<void> {
  await db
    .update(pipelineRuns)
    .set({
      finishedAt: new Date().toISOString(),
      status,
      errorMessage: err instanceof Error ? err.message : err ? String(err) : null,
    })
    .where(eq(pipelineRuns.id, id));
}

export async function updatePipelineRunRows(
  id: number,
  rowsAffected: number,
  db: DrizzleDb = defaultDb,
): Promise<void> {
  await db.update(pipelineRuns).set({ rowsAffected }).where(eq(pipelineRuns.id, id));
}

export async function logDrift(
  source: string,
  fieldPath: string,
  unexpectedValue?: string,
  payloadSample?: string,
  db: DrizzleDb = defaultDb,
): Promise<void> {
  await db.insert(apiDriftLog).values({
    detectedAt: new Date().toISOString(),
    source,
    fieldPath,
    unexpectedValue,
    payloadSample,
  });
}
