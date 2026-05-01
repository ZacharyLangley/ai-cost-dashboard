import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'username', 'displayName', 'm365Upn', 'upn', 'ghUsername',
      '*.username', '*.displayName', '*.m365Upn', '*.upn', '*.ghUsername',
    ],
    censor: '[redacted]',
  },
});
