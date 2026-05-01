import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const identityMap = sqliteTable('identity_map', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ghUsername: text('gh_username').unique(),
  m365Upn: text('m365_upn').unique(),
  displayName: text('display_name').notNull(),
  team: text('team').notNull(),
  costCenter: text('cost_center'),
  startDate: text('start_date'),
  endDate: text('end_date'),
});
