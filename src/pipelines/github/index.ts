import { db as defaultDb } from '../../db/client.js';
import type { DrizzleDb } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import { notifyOps } from '../../lib/notify.js';
import { startPipelineRun, finishPipelineRun, updatePipelineRunRows } from '../pipeline-runs.js';
import { ingestUsage } from './ingest-usage.js';
import { ingestSeats } from './ingest-seats.js';
import { ingestMetrics } from './ingest-metrics.js';
import type { PipelineResult } from '../../services/github/types.js';

export async function runGitHubPipeline(db: DrizzleDb = defaultDb): Promise<PipelineResult> {
  const runId = await startPipelineRun('github', db);
  logger.info({ runId }, 'github pipeline started');

  try {
    const [usage, seats, metrics] = await Promise.all([
      ingestUsage(db),
      ingestSeats(db),
      ingestMetrics(db),
    ]);

    const rowsAffected = usage.rowsAffected + seats.rowsAffected + metrics.rowsAffected;
    await updatePipelineRunRows(runId, rowsAffected, db);
    await finishPipelineRun(runId, 'success', undefined, db);

    logger.info({ runId, rowsAffected }, 'github pipeline complete');
    return { runId, status: 'success', rowsAffected };
  } catch (err) {
    await finishPipelineRun(runId, 'failed', err, db);
    await notifyOps(`GitHub pipeline run #${runId} failed. Check /admin/pipelines for details.`, 'error');
    logger.error({ runId, err }, 'github pipeline failed');
    throw err;
  }
}
