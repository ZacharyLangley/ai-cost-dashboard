import { createInterface } from 'readline';
import { Readable } from 'stream';
import { ghRequest } from './client.js';
import {
  orgMetricsResponseSchema,
  enterpriseUserReportRowSchema,
  enterpriseMetricsLinkSchema,
} from './schemas.js';
import { logger } from '../../lib/logger.js';
import type { OrgMetricsDay, EnterpriseUserReportRow } from './types.js';

export async function fetchOrgMetrics(org: string): Promise<OrgMetricsDay[]> {
  const raw = await ghRequest<unknown>(`/orgs/${org}/copilot/metrics`);
  return orgMetricsResponseSchema.parse(raw);
}

export async function fetchEnterpriseUserReport(
  enterprise: string,
  days: 1 | 28,
): Promise<EnterpriseUserReportRow[]> {
  const suffix = days === 1 ? 'users-1-day/latest' : 'users-28-day/latest';
  const linkRaw = await ghRequest<unknown>(
    `/enterprises/${enterprise}/copilot/metrics/reports/${suffix}`,
  );
  const { download_url } = enterpriseMetricsLinkSchema.parse(linkRaw);

  const res = await fetch(download_url);
  if (!res.ok || !res.body) {
    throw new Error(`NDJSON fetch failed: ${res.status}`);
  }

  // Web ReadableStream → Node Readable for readline (Node 17+)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readable = Readable.fromWeb(res.body as any);
  const rl = createInterface({ input: readable, crlfDelay: Infinity });

  const rows: EnterpriseUserReportRow[] = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const parsed = enterpriseUserReportRowSchema.safeParse(JSON.parse(line));
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      logger.warn({ line: line.substring(0, 200) }, 'enterprise report row parse failed');
    }
  }

  return rows;
}
