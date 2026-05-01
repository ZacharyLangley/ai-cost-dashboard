import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

connection.on('error', (err: Error) => {
  logger.warn({ err: err.message }, 'Redis connection error');
});

const queue = new Queue('m365-interactions', { connection });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const worker = new Worker('m365-interactions', async () => {}, { connection });

worker.on('ready', () => {
  logger.info('Worker ready: m365-interactions');
});

logger.info('Worker started');

// keep process alive
queue.getJobCounts().catch(() => {});
