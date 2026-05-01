import type { FastifyPluginAsync } from 'fastify';
import type { DrizzleDb } from '../../db/client.js';
import { monthParam, monthsParam, sortParam } from '../schemas/common.js';
import { ValidationError } from '../../lib/errors.js';
import { listDevelopers, getDeveloper } from '../../services/queries/developers.js';
import { z } from 'zod';

const listQuerySchema = z.object({
  month: monthParam.optional(),
  team: z.string().optional(),
  sort: sortParam,
});

const detailQuerySchema = z.object({
  months: monthsParam,
});

export const developerRoutes: FastifyPluginAsync<{ db: DrizzleDb }> = async (server, opts) => {
  server.get('/api/developers', async (req) => {
    const q = listQuerySchema.safeParse(req.query);
    if (!q.success) throw new ValidationError('Invalid query', q.error.flatten().fieldErrors);
    return listDevelopers(q.data, opts.db);
  });

  server.get<{ Params: { username: string } }>('/api/developers/:username', async (req) => {
    const q = detailQuerySchema.safeParse(req.query);
    if (!q.success) throw new ValidationError('Invalid query', q.error.flatten().fieldErrors);
    return getDeveloper(req.params.username, q.data.months, opts.db);
  });
};
