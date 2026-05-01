import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const rawGhUsage = sqliteTable(
  'raw_gh_usage',
  {
    pullDate: text('pull_date').notNull(),
    billingMonth: text('billing_month').notNull(),
    payload: text('payload').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pullDate, t.billingMonth] }),
  }),
);

export const rawM365Usage = sqliteTable(
  'raw_m365_usage',
  {
    pullDate: text('pull_date').notNull(),
    pageIndex: integer('page_index').notNull(),
    payload: text('payload').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pullDate, t.pageIndex] }),
  }),
);
