import type { FastifyInstance } from 'fastify';
import { runGitHubPipeline } from '../../pipelines/github/index.js';
import { logger } from '../../lib/logger.js';

export async function adminRoutes(server: FastifyInstance) {
  server.post('/api/admin/pipelines/github/run', async (_req, reply) => {
    try {
      const result = await runGitHubPipeline();
      return reply.send(result);
    } catch (err) {
      logger.error({ err }, 'pipeline run failed');
      return reply.code(500).send({
        error: err instanceof Error ? err.message : 'pipeline failed',
      });
    }
  });
}
