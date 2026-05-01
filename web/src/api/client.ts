class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [
    string,
    string | number,
  ][];
  if (!entries.length) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export const api = {
  // Org
  orgSummary: () => apiFetch<import('./types').OrgSummary>('/api/org/summary'),
  orgIdleSeats: (product?: string) =>
    apiFetch<import('./types').IdleSeat[]>(`/api/org/idle-seats${qs({ product })}`),
  orgTrend: (months?: number, groupBy?: string) =>
    apiFetch<import('./types').TrendPoint[]>(`/api/org/trend${qs({ months, groupBy })}`),

  // Developers
  developers: (params: { month?: string; team?: string; sort?: string } = {}) =>
    apiFetch<import('./types').DeveloperSummary[]>(`/api/developers${qs(params)}`),
  developer: (username: string, months?: number) =>
    apiFetch<import('./types').DeveloperDetail>(
      `/api/developers/${encodeURIComponent(username)}${qs({ months })}`,
    ),

  // Teams
  teams: (month?: string) =>
    apiFetch<import('./types').TeamSummary[]>(`/api/teams${qs({ month })}`),
  team: (teamName: string, months?: number) =>
    apiFetch<import('./types').TeamDetail>(
      `/api/teams/${encodeURIComponent(teamName)}${qs({ months })}`,
    ),

  // Products
  githubModels: (month?: string) =>
    apiFetch<import('./types').GithubModel[]>(`/api/products/github/models${qs({ month })}`),
  acceptanceVsCost: () =>
    apiFetch<import('./types').AcceptanceVsCost[]>('/api/products/github/acceptance-vs-cost'),
  m365Heatmap: () =>
    apiFetch<import('./types').M365HeatmapRow[]>('/api/products/m365/adoption-heatmap'),
  m365Breadth: () =>
    apiFetch<import('./types').M365BreadthRow[]>('/api/products/m365/breadth'),

  // Meta
  pipelineStatus: () =>
    apiFetch<import('./types').PipelineStatus[]>('/api/meta/pipeline-status'),
  apiDrift: (since?: string) =>
    apiFetch<import('./types').ApiDriftEntry[]>(`/api/meta/api-drift${qs({ since })}`),
  hashingStatus: () =>
    apiFetch<import('./types').HashingStatus>('/api/meta/hashing-status'),

  // Admin
  triggerPipeline: (pipeline: string) =>
    apiFetch<{ runId: number; status: string }>(`/api/admin/pipelines/${pipeline}/run`, {
      method: 'POST',
    }),
};
