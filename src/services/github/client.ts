import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { GitHubNotFoundError } from '../../lib/errors.js';
import { assertSafeUrl } from '../../lib/safe-fetch.js';

const BASE_URL = 'https://api.github.com';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function ghFetch(
  path: string,
  options: RequestInit = {},
  attempt = 0,
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  // Validate external URLs from API responses (e.g. presigned NDJSON download_url)
  if (path.startsWith('http')) assertSafeUrl(url);
  const start = Date.now();

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: 'application/vnd.github+json',
      ...(options.headers as Record<string, string>),
    },
  });

  const duration = Date.now() - start;
  logger.info(
    { method: options.method ?? 'GET', path, status: res.status, duration },
    'github api',
  );

  if (res.status === 404) throw new GitHubNotFoundError(path);

  if (res.status === 429) {
    const reset = res.headers.get('X-RateLimit-Reset');
    const retryAfter = res.headers.get('Retry-After');
    const waitMs = retryAfter
      ? parseInt(retryAfter, 10) * 1_000
      : reset
        ? Math.max(1_000, parseInt(reset, 10) * 1_000 - Date.now() + 1_000)
        : 60_000;
    logger.warn({ waitMs }, 'rate limited, waiting');
    await sleep(waitMs);
    return ghFetch(path, options, attempt + 1);
  }

  if (res.status >= 500 && attempt < 2) {
    const backoff = Math.pow(2, attempt) * 1_000;
    logger.warn({ status: res.status, attempt, backoff }, '5xx, retrying');
    await sleep(backoff);
    return ghFetch(path, options, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status} at ${path}: ${body}`);
  }

  return res;
}

export async function ghRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await ghFetch(path, options);
  return res.json() as Promise<T>;
}
