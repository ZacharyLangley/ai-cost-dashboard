import type { FastifyPluginAsync } from 'fastify';
import type { DrizzleDb } from '../../db/client.js';
import { monthParam, monthsParam } from '../schemas/common.js';
import { ValidationError } from '../../lib/errors.js';
import { listTeams, getTeam } from '../../services/queries/teams.js';
import { z } from 'zod';

const listQuerySchema = z.object({
  month: monthParam.optional(),
});

const detailQuerySchema = z.object({
  months: monthsParam,
});

export const teamRoutes: FastifyPluginAsync<{ db: DrizzleDb }> = async (server, opts) => {
  server.get('/api/teams', async (req) => {
    const q = listQuerySchema.safeParse(req.query);
    if (!q.success) throw new ValidationError('Invalid query', q.error.flatten().fieldErrors);
    return listTeams(q.data, opts.db);
  });

  server.get<{ Params: { teamName: string } }>('/api/teams/:teamName', async (req) => {
    const q = detailQuerySchema.safeParse(req.query);
    if (!q.success) throw new ValidationError('Invalid query', q.error.flatten().fieldErrors);
    return getTeam(decodeURIComponent(req.params.teamName), q.data.months, opts.db);
  });
};
