import type { Config } from 'drizzle-kit';

export default {
  schema: [
    './src/db/schema/raw.ts',
    './src/db/schema/github.ts',
    './src/db/schema/m365.ts',
    './src/db/schema/identity.ts',
    './src/db/schema/meta.ts',
  ],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/copilot.db',
  },
} satisfies Config;
