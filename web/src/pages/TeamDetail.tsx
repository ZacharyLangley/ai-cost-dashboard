import { useParams, useNavigate } from 'react-router-dom';
import { useTeam } from '../api/hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { TrendChart } from '../components/TrendChart';
import { DataTable, type Column } from '../components/DataTable';
import { formatCurrency } from '../lib/formatCurrency';
import { COLORS } from '../lib/colors';
import type { DeveloperSummary } from '../api/types';

const devCols: Column<DeveloperSummary>[] = [
  { key: 'displayName', header: 'Developer', sortFn: (a, b) => a.displayName.localeCompare(b.displayName) },
  {
    key: 'totalCost',
    header: 'Total Cost',
    render: (r) => formatCurrency(r.totalCost),
    sortFn: (a, b) => a.totalCost - b.totalCost,
  },
  {
    key: 'ghUsageCost',
    header: 'GH Usage',
    render: (r) => formatCurrency(r.ghUsageCost),
    sortFn: (a, b) => a.ghUsageCost - b.ghUsageCost,
  },
  {
    key: 'daysIdle',
    header: 'Idle',
    render: (r) =>
      r.daysIdle !== null && r.daysIdle > 30 ? (
        <span className="text-amber-600">{r.daysIdle}d</span>
      ) : (
        <span className="text-green-600">Active</span>
      ),
    sortFn: (a, b) => (a.daysIdle ?? 0) - (b.daysIdle ?? 0),
  },
];

export default function TeamDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useTeam(name ?? '');

  if (isLoading) return <LoadingSpinner />;
  if (error || !data)
    return <EmptyState title="Team not found" description={String(error ?? 'No data')} />;

  const trendData = data.monthly.map((m) => ({ period: m.billingMonth, cost: m.cost }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/teams')} className="text-sm text-blue-600 hover:underline">
          Teams
        </button>
        <span className="text-gray-400">/</span>
        <h1 className="text-xl font-bold text-gray-900">{name}</h1>
      </div>

      {data.monthly.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Cost Trend (6 months)</h2>
          <TrendChart
            data={trendData}
            lines={[{ key: 'cost', color: COLORS.ghUsage, label: 'Cost' }]}
          />
        </div>
      )}

      {data.topModels.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Top Models</h2>
          <div className="flex flex-wrap gap-3">
            {data.topModels.map((m) => (
              <div key={m.model} className="rounded border border-gray-200 px-3 py-2 text-sm">
                <span className="font-medium">{m.model}</span>
                <span className="ml-2 text-gray-500">{formatCurrency(m.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Developers</h2>
        <DataTable
          columns={devCols}
          data={data.developers}
          defaultSort="totalCost"
          onRowClick={(r) => navigate(`/developers/${encodeURIComponent(r.username)}`)}
        />
      </div>
    </div>
  );
}
