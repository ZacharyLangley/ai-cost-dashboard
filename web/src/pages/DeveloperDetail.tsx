import { useParams, useNavigate } from 'react-router-dom';
import { useDeveloper } from '../api/hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { CostBreakdownBar } from '../components/CostBreakdownBar';
import { TrendChart } from '../components/TrendChart';
import { formatCurrency } from '../lib/formatCurrency';
import { formatDate, daysAgoLabel } from '../lib/formatDate';
import { modelColor } from '../lib/colors';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useOrgSummary } from '../api/hooks';

function M365AppHeatmap({
  apps,
}: {
  apps: { app: string; lastActive: string | null }[];
}) {
  if (!apps.length) return <p className="text-xs text-gray-400">No M365 data</p>;

  function intensity(lastActive: string | null): string {
    if (!lastActive) return 'bg-gray-100';
    const days = Math.floor((Date.now() - new Date(lastActive).getTime()) / 86_400_000);
    if (days <= 7) return 'bg-green-400';
    if (days <= 30) return 'bg-green-200';
    if (days <= 90) return 'bg-amber-200';
    return 'bg-red-200';
  }

  return (
    <div className="flex flex-wrap gap-2">
      {apps.map((a) => (
        <div
          key={a.app}
          className={`rounded px-3 py-2 text-xs font-medium ${intensity(a.lastActive)}`}
          title={a.lastActive ? `Last active: ${formatDate(a.lastActive)}` : 'Never active'}
        >
          {a.app}
          <div className="mt-0.5 text-gray-600">{daysAgoLabel(a.lastActive ? Math.floor((Date.now() - new Date(a.lastActive).getTime()) / 86_400_000) : null)}</div>
        </div>
      ))}
    </div>
  );
}

export default function DeveloperDetail() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useDeveloper(username ?? '');
  const { data: summary } = useOrgSummary();

  if (isLoading) return <LoadingSpinner />;
  if (error || !data)
    return <EmptyState title="Developer not found" description={String(error ?? 'No data')} />;

  const monthlyForChart = data.monthly.map((m) => ({ period: m.billingMonth, cost: m.cost }));
  const latestCost = data.monthly[data.monthly.length - 1]?.cost ?? 0;
  const ghSeatCost = summary?.breakdown.ghSeats
    ? summary.breakdown.ghSeats / Math.max(summary.activeDevs, 1)
    : 0;
  const m365SeatCost = summary?.breakdown.m365Seats
    ? summary.breakdown.m365Seats / Math.max(summary.activeDevs, 1)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/developers')}
          className="text-sm text-blue-600 hover:underline"
        >
          Developers
        </button>
        <span className="text-gray-400">/</span>
        <h1 className="text-xl font-bold text-gray-900">{data.identity.displayName}</h1>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          {data.identity.team}
        </span>
      </div>

      {data.idle.github && (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          No GitHub activity for {data.idle.daysIdle} days
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Cost Breakdown</h2>
        <CostBreakdownBar
          ghSeats={ghSeatCost}
          ghUsage={latestCost}
          m365Seats={m365SeatCost}
        />
      </div>

      {monthlyForChart.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Cost Trend (6 months)</h2>
          <TrendChart
            data={monthlyForChart}
            lines={[{ key: 'cost', color: '#0969da', label: 'GH Usage Cost' }]}
          />
        </div>
      )}

      {data.modelMix.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Model Mix</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={data.modelMix} dataKey="cost" nameKey="model" cx="50%" cy="50%" outerRadius={80}>
                  {data.modelMix.map((entry) => (
                    <Cell key={entry.model} fill={modelColor(entry.model)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 text-sm">
              {data.modelMix.map((m) => (
                <div key={m.model} className="flex gap-4">
                  <span className="font-medium">{m.model}</span>
                  <span className="text-gray-500">{formatCurrency(m.cost)}</span>
                  <span className="text-gray-400">{m.requests} req</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {data.acceptanceRate !== null && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">Acceptance Rate</h2>
          <p className="text-2xl font-bold text-gray-900">
            {(data.acceptanceRate * 100).toFixed(1)}%
          </p>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">M365 App Activity</h2>
        <M365AppHeatmap apps={data.m365Apps} />
      </div>
    </div>
  );
}
