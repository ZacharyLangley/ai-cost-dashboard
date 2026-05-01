import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const pipelineRuns = sqliteTable('pipeline_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pipeline: text('pipeline').notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  status: text('status').notNull(),
  errorMessage: text('error_message'),
  rowsAffected: integer('rows_affected'),
});

export const apiDriftLog = sqliteTable('api_drift_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  detectedAt: text('detected_at').notNull(),
  source: text('source').notNull(),
  fieldPath: text('field_path').notNull(),
  unexpectedValue: text('unexpected_value'),
  payloadSample: text('payload_sample'),
});
