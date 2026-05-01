import { db as defaultDb } from '../../db/client.js';
import type { DrizzleDb } from '../../db/client.js';
import { ghMetricsDaily } from '../../db/schema/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { fetchOrgMetrics, fetchEnterpriseUserReport } from '../../services/github/metrics.js';
import { GitHubNotFoundError } from '../../lib/errors.js';

export async function ingestMetrics(db: DrizzleDb = defaultDb): Promise<{ rowsAffected: number }> {
  if (!env.GITHUB_ORG) {
    logger.warn('GITHUB_ORG not configured, skipping metrics ingest');
    return { rowsAffected: 0 };
  }

  let rows = 0;

  // Org-level aggregate metrics (no per-user breakdown)
  try {
    const days = await fetchOrgMetrics(env.GITHUB_ORG);
    for (const day of days) {
      const editors = day.copilot_ide_code_completions?.editors ?? [];
      for (const editor of editors) {
        const suggestions =
          editor.models?.reduce((sum, m) => sum + (m.total_code_suggestions ?? 0), 0) ?? 0;
        const acceptances =
          editor.models?.reduce((sum, m) => sum + (m.total_code_acceptances ?? 0), 0) ?? 0;

        await db
          .insert(ghMetricsDaily)
          .values({
            metricDate: day.date,
            username: '__org__',
            ide: editor.name,
            feature: 'completions',
            suggestions,
            acceptances,
          })
          .onConflictDoUpdate({
            target: [
              ghMetricsDaily.metricDate,
              ghMetricsDaily.username,
              ghMetricsDaily.ide,
              ghMetricsDaily.feature,
            ],
            set: { suggestions, acceptances },
          });
        rows++;
      }
    }
    logger.info({ rows }, 'org metrics ingest complete');
  } catch (err) {
    if (err instanceof GitHubNotFoundError) {
      logger.warn('org metrics endpoint 404 — metrics API access policy may be disabled');
    } else {
      throw err;
    }
  }

  // Enterprise per-user metrics (optional)
  if (env.GITHUB_ENTERPRISE) {
    try {
      const userRows = await fetchEnterpriseUserReport(env.GITHUB_ENTERPRISE, 1);
      for (const row of userRows) {
        await db
          .insert(ghMetricsDaily)
          .values({
            metricDate: row.date,
            username: row.login,
            ide: row.editor ?? 'unknown',
            feature: row.feature ?? 'completions',
            suggestions: row.suggestions ?? null,
            acceptances: row.acceptances ?? null,
          })
          .onConflictDoUpdate({
            target: [
              ghMetricsDaily.metricDate,
              ghMetricsDaily.username,
              ghMetricsDaily.ide,
              ghMetricsDaily.feature,
            ],
            set: {
              suggestions: row.suggestions ?? null,
              acceptances: row.acceptances ?? null,
            },
          });
        rows++;
      }
      logger.info({ rows }, 'enterprise metrics ingest complete');
    } catch (err) {
      if (err instanceof GitHubNotFoundError) {
        logger.warn('enterprise metrics endpoint 404');
      } else {
        throw err;
      }
    }
  }

  return { rowsAffected: rows };
}
