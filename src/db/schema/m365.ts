import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

export const m365UsageFacts = sqliteTable(
  'm365_usage_facts',
  {
    pullDate: text('pull_date').notNull(),
    upn: text('upn').notNull(),
    upnIsHashed: integer('upn_is_hashed', { mode: 'boolean' }).notNull(),
    displayName: text('display_name'),
    lastActivity: text('last_activity'),
    daysSinceActive: integer('days_since_active'),
    seatSku: text('seat_sku').notNull(),
    seatCostUsd: real('seat_cost_usd').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pullDate, t.upn] }),
  }),
);

export const m365AppActivity = sqliteTable(
  'm365_app_activity',
  {
    pullDate: text('pull_date').notNull(),
    upn: text('upn').notNull(),
    app: text('app').notNull(),
    lastActive: text('last_active'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pullDate, t.upn, t.app] }),
  }),
);

export const m365InteractionsWeekly = sqliteTable(
  'm365_interactions_weekly',
  {
    weekStarting: text('week_starting').notNull(),
    upn: text('upn').notNull(),
    appContext: text('app_context').notNull(),
    interactionCount: integer('interaction_count').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.weekStarting, t.upn, t.appContext] }),
  }),
);
