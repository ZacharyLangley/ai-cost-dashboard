import { logger } from './logger.js';
import { env } from '../config/env.js';

export async function notifyOps(message: string, severity: 'warn' | 'error'): Promise<void> {
  if (severity === 'error') {
    logger.error(message);
  } else {
    logger.warn(message);
  }

  if (!env.OPS_WEBHOOK_URL) return;

  const emoji = severity === 'error' ? ':red_circle:' : ':warning:';
  const body = JSON.stringify({ text: `${emoji} *AI Cost Dashboard*: ${message}` });

  try {
    const res = await fetch(env.OPS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'ops webhook returned non-200');
    }
  } catch (err) {
    logger.warn({ err }, 'ops webhook post failed');
  }
}
