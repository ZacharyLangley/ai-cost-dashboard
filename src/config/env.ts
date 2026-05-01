import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().default('file:./data/copilot.db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  GITHUB_TOKEN: z.string().default(''),
  GITHUB_ORG: z.string().default(''),
  GITHUB_ENTERPRISE: z.string().default(''),
  AZURE_TENANT_ID: z.string().default(''),
  AZURE_CLIENT_ID: z.string().default(''),
  AZURE_CLIENT_SECRET: z.string().default(''),
  GH_SEAT_COST_USD: z.coerce.number().default(19),
  M365_SEAT_COST_USD: z.coerce.number().default(30),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
