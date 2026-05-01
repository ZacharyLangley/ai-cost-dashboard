import type { FastifyPluginAsync } from 'fastify';
import { runGitHubPipeline } from '../../pipelines/github/index.js';
import { logger } from '../../lib/logger.js';
import { db as defaultDb } from '../../db/client.js';
import type { DrizzleDb } from '../../db/client.js';
import { identityMap } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const importRowSchema = z.object({
  ghUsername: z.string().optional(),
  m365Upn: z.string().optional(),
  displayName: z.string().optional(),
  team: z.string().optional(),
});

const importBodySchema = z.object({ rows: z.array(importRowSchema) });

export const adminRoutes: FastifyPluginAsync<{ db?: DrizzleDb }> = async (server, opts) => {
  const db = opts.db ?? defaultDb;

  server.post('/api/admin/pipelines/:pipeline/run', async (req, reply) => {
    const { pipeline } = req.params as { pipeline: string };
    try {
      if (pipeline === 'github') {
        const result = await runGitHubPipeline();
        return reply.send(result);
      }
      return reply.code(404).send({ error: `Unknown pipeline: ${pipeline}` });
    } catch (err) {
      logger.error({ err }, 'pipeline run failed');
      return reply.code(500).send({ error: err instanceof Error ? err.message : 'pipeline failed' });
    }
  });

  server.post('/api/admin/identity/import', async (req, reply) => {
    const body = importBodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid body', details: body.error.flatten() });
    }

    let added = 0;
    let updated = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < body.data.rows.length; i++) {
      const row = body.data.rows[i]!;
      if (!row.ghUsername && !row.m365Upn) {
        errors.push({ row: i + 2, message: 'Missing gh_username and m365_upn' });
        continue;
      }
      try {
        const existing = row.ghUsername
          ? await db.select().from(identityMap).where(eq(identityMap.ghUsername, row.ghUsername)).limit(1)
          : row.m365Upn
            ? await db.select().from(identityMap).where(eq(identityMap.m365Upn, row.m365Upn)).limit(1)
            : [];

        if (existing.length) {
          await db
            .update(identityMap)
            .set({
              m365Upn: row.m365Upn ?? existing[0]!.m365Upn,
              displayName: row.displayName ?? existing[0]!.displayName,
              team: row.team ?? existing[0]!.team,
            })
            .where(eq(identityMap.id, existing[0]!.id));
          updated++;
        } else {
          await db.insert(identityMap).values({
            ghUsername: row.ghUsername ?? null,
            m365Upn: row.m365Upn ?? null,
            displayName: row.displayName ?? row.ghUsername ?? row.m365Upn ?? '',
            team: row.team ?? 'Unmapped',
          });
          added++;
        }
      } catch (e) {
        errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
      }
    }

    return reply.send({ added, updated, errors });
  });
};
