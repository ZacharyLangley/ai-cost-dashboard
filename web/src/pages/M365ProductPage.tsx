import { useM365Heatmap, useM365Breadth, useOrgIdleSeats, useHashingStatus } from '../api/hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { DataTable, type Column } from '../components/DataTable';
import { formatCurrency } from '../lib/formatCurrency';
import { formatDate } from '../lib/formatDate';
import type { IdleSeat, M365HeatmapRow, M365BreadthRow } from '../api/types';

const APPS = ['teams', 'word', 'excel', 'powerpoint', 'outlook', 'chat'] as const;

function intensityClass(lastActive: string | null): string {
  if (!lastActive) return 'bg-gray-100 text-gray-300';
  const days = Math.floor((Date.now() - new Date(lastActive).getTime()) / 86_400_000);
  if (days <= 7) return 'bg-green-500 text-white';
  if (days <= 30) return 'bg-green-300 text-green-900';
  if (days <= 90) return 'bg-amber-300 text-amber-900';
  return 'bg-red-200 text-red-800';
}

function AdoptionHeatmap({ data }: { data: M365HeatmapRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left font-medium text-gray-500">Developer</th>
            <th className="px-2 py-1 text-left font-medium text-gray-500">Team</th>
            {APPS.map((a) => (
              <th key={a} className="px-2 py-1 text-center font-medium capitalize text-gray-500">
                {a}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.upn} className="border-t border-gray-100">
              <td className="px-2 py-1 font-medium">{row.displayName}</td>
              <td className="px-2 py-1 text-gray-500">{row.team}</td>
              {APPS.map((app) => (
                <td key={app} className="px-1 py-1 text-center">
                  <span
                    className={`inline-block h-6 w-12 rounded text-center text-[10px] leading-6 ${intensityClass(row.apps[app] ?? null)}`}
                    title={row.apps[app] ? `Last: ${formatDate(row.apps[app]!)}` : 'Never'}
                  >
                    {row.apps[app] ? '✓' : '—'}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const idleCols: Column<IdleSeat>[] = [
  {
    key: 'displayName',
    header: 'User',
    render: (r) => r.displayName ?? r.username,
    sortFn: (a, b) => (a.displayName ?? a.username).localeCompare(b.displayName ?? b.username),
  },
  { key: 'team', header: 'Team', render: (r) => r.team ?? '—' },
  {
    key: 'seatCostUsd',
    header: 'Seat Cost',
    render: (r) => formatCurrency(r.seatCostUsd),
    sortFn: (a, b) => a.seatCostUsd - b.seatCostUsd,
  },
  {
    key: 'daysIdle',
    header: 'Days Idle',
    render: (r) => (r.daysIdle !== null ? `${r.daysIdle}d` : 'Never active'),
    sortFn: (a, b) => (a.daysIdle ?? 999) - (b.daysIdle ?? 999),
  },
];

const breadthCols: Column<M365BreadthRow>[] = [
  {
    key: 'displayName',
    header: 'Developer',
    sortFn: (a, b) => a.displayName.localeCompare(b.displayName),
  },
  { key: 'team', header: 'Team' },
  {
    key: 'appCount',
    header: 'Apps',
    sortFn: (a, b) => a.appCount - b.appCount,
  },
  { key: 'apps', header: 'Apps Used', render: (r) => r.apps.join(', ') },
];

export default function M365ProductPage() {
  const { data: hashing } = useHashingStatus();
  const { data: heatmap, isLoading: heatmapLoading } = useM365Heatmap();
  const { data: breadth, isLoading: breadthLoading } = useM365Breadth();
  const { data: idleSeats, isLoading: idleLoading } = useOrgIdleSeats('m365');

  if (heatmapLoading || breadthLoading || idleLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Microsoft 365 Copilot</h1>

      {hashing?.m365UpnHashed && (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          UPN hashing is enabled. Per-user views show hashed identifiers. Disable in M365 Admin Center
          (Reports &gt; Privacy settings &gt; Show user details) for full visibility.
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Adoption Heatmap</h2>
        {!heatmap?.length ? (
          <EmptyState title="No M365 data" />
        ) : (
          <AdoptionHeatmap data={heatmap} />
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">App Breadth</h2>
        <DataTable columns={breadthCols} data={breadth ?? []} defaultSort="appCount" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Inactive Seats</h2>
        {!idleSeats?.length ? (
          <EmptyState title="No inactive M365 seats" />
        ) : (
          <DataTable columns={idleCols} data={idleSeats} defaultSort="daysIdle" />
        )}
      </div>
    </div>
  );
}
