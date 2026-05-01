import { ghRequest } from './client.js';
import type { UsageResponse } from './types.js';

export async function fetchMonthlyUsage(
  org: string,
  year: number,
  month: number,
): Promise<UsageResponse> {
  const m = String(month).padStart(2, '0');
  return ghRequest<UsageResponse>(
    `/organizations/${org}/settings/billing/premium_request/usage?year=${year}&month=${m}`,
  );
}
