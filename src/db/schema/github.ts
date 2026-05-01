import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const ghUsageFacts = sqliteTable(
  'gh_usage_facts',
  {
    billingMonth: text('billing_month').notNull(),
    username: text('username').notNull(),
    product: text('product').notNull(),
    sku: text('sku').notNull(),
    model: text('model').notNull(),
    unitType: text('unit_type').notNull(),
    pricePerUnit: real('price_per_unit').notNull(),
    grossQty: integer('gross_qty').notNull(),
    grossAmount: real('gross_amount').notNull(),
    discountQty: integer('discount_qty').notNull(),
    discountAmount: real('discount_amount').notNull(),
    netQty: integer('net_qty').notNull(),
    netAmount: real('net_amount').notNull(),
    pulledAt: text('pulled_at').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.billingMonth, t.username, t.sku, t.model] }),
    byUser: index('gh_usage_by_user').on(t.username, t.billingMonth),
    byMonth: index('gh_usage_by_month').on(t.billingMonth),
  }),
);

export const ghSeats = sqliteTable(
  'gh_seats',
  {
    snapshotDate: text('snapshot_date').notNull(),
    username: text('username').notNull(),
    planType: text('plan_type').notNull(),
    seatCostUsd: real('seat_cost_usd').notNull(),
    lastActivityAt: text('last_activity_at'),
    assigneeTeam: text('assignee_team'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.snapshotDate, t.username] }),
  }),
);

export const ghMetricsDaily = sqliteTable(
  'gh_metrics_daily',
  {
    metricDate: text('metric_date').notNull(),
    username: text('username').notNull(),
    ide: text('ide').notNull(),
    feature: text('feature').notNull(),
    suggestions: integer('suggestions'),
    acceptances: integer('acceptances'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.metricDate, t.username, t.ide, t.feature] }),
  }),
);
