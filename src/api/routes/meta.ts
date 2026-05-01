import type { FastifyPluginAsync } from 'fastify';
import type { DrizzleDb } from '../../db/client.js';
import { ValidationError } from '../../lib/errors.js';
import { getPipelineStatus, getApiDrift, getHashingStatus } from '../../services/queries/meta.js';
import { z } from 'zod';

const driftQuerySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
});

export const metaRoutes: FastifyPluginAsync<{ db: DrizzleDb }> = async (server, opts) => {
  server.get('/api/meta/pipeline-status', async () => {
    return getPipelineStatus(opts.db);
  });

  server.get('/api/meta/api-drift', async (req) => {
    const q = driftQuerySchema.safeParse(req.query);
    if (!q.success) throw new ValidationError('Invalid query', q.error.flatten().fieldErrors);
    return getApiDrift(q.data.since, opts.db);
  });

  server.get('/api/meta/hashing-status', async () => {
    return getHashingStatus(opts.db);
  });
};
