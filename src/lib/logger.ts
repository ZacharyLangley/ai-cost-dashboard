import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      // HTTP auth headers
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.headers["x-auth-token"]',
      'res.headers["set-cookie"]',
      // Request body secrets
      'body.token',
      'body.clientSecret',
      'body.apiKey',
      // Query string tokens (some OAuth flows put tokens here)
      'req.query.token',
      'req.query.access_token',
      // HTTP client errors attach full request config including auth
      'err.config.headers.authorization',
      'err.config.auth',
      // PII
      'username', 'displayName', 'm365Upn', 'upn', 'ghUsername',
      '*.username', '*.displayName', '*.m365Upn', '*.upn', '*.ghUsername',
    ],
    censor: '[redacted]',
  },
});
