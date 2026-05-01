import { useNavigate } from 'react-router-dom';
import { useOrgSummary, useOrgTrend, useDevelopers, useTeams } from '../api/hooks';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { TrendChart } from '../components/TrendChart';
import { DataTable, type Column } from '../components/DataTable';
import { formatCurrency } from '../lib/formatCurrency';
import { COLORS } from '../lib/colors';
import type { DeveloperSummary, TeamSummary, TrendPoint } from '../api/types';

function buildTrendData(points: TrendPoint[]): { period: string; [k: string]: number | string }[] {
  const map = new Map<string, { period: string; [k: string]: number | string }>();
  for (const p of points) {
    if (!map.has(p.period)) map.set(p.period, { period: p.period });
    const row = map.get(p.period)!;
    row[p.group] = (Number(row[p.group] ?? 0)) + p.cost;
  }
  return Array.from(map.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
}

const devCols: Column<DeveloperSummary>[] = [
  { key: 'displayName', header: 'Developer' },
  {
    key: 'totalCost',
    header: 'Total Cost',
    render: (r) => formatCurrency(r.totalCost),
    sortFn: (a, b) => a.totalCost - b.totalCost,
  },
  { key: 'team', header: 'Team' },
];

const teamCols: Column<TeamSummary>[] = [
  { key: 'team', header: 'Team' },
  {
    key: 'totalCost',
    header: 'Total Cost',
    render: (r) => formatCurrency(r.totalCost),
    sortFn: (a, b) => a.totalCost - b.totalCost,
  },
  {
    key: 'devCount',
    header: 'Devs',
    sortFn: (a, b) => a.devCount - b.devCount,
  },
];

export default function OrgOverview() {
  const navigate = useNavigate();
  const { data: summary, isLoading: summaryLoading } = useOrgSummary();
  const { data: trendRaw } = useOrgTrend(12, 'product');
  const { data: devs } = useDevelopers({ sort: 'cost' });
  const { data: teams } = useTeams();

  if (summaryLoading) return <LoadingSpinner />;

  const trendData = trendRaw ? buildTrendData(trendRaw) : [];
  const groups = [...new Set(trendRaw?.map((t) => t.group) ?? [])];
  const lineColors = [COLORS.ghUsage, COLORS.ghSeats, COLORS.m365Seats];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Org Overview</h1>

      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Monthly Cost"
            value={formatCurrency(summary.totalCostMonth)}
            sub="All products"
          />
          <StatCard label="Active Devs" value={summary.activeDevs} />
          <StatCard
            label="Idle Seats"
            value={summary.idleSeats.github + summary.idleSeats.m365}
            accent={summary.idleSeats.github + summary.idleSeats.m365 > 0 ? 'warning' : 'default'}
            sub={`GH: ${summary.idleSeats.github} / M365: ${summary.idleSeats.m365}`}
          />
          <StatCard
            label="Unmapped Users"
            value={summary.unmappedCount}
            accent={summary.unmappedCount > 0 ? 'warning' : 'default'}
          />
        </div>
      )}

      {trendData.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">12-Month Cost Trend</h2>
          <TrendChart
            data={trendData}
            lines={groups.map((g, i) => ({ key: g, color: lineColors[i % lineColors.length] ?? COLORS.muted, label: g }))}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Top 10 Developers by Cost</h2>
          <DataTable
            columns={devCols}
            data={(devs ?? []).slice(0, 10)}
            defaultSort="totalCost"
            onRowClick={(r) => navigate(`/developers/${encodeURIComponent(r.username)}`)}
          />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Top 10 Teams by Cost</h2>
          <DataTable
            columns={teamCols}
            data={(teams ?? []).slice(0, 10)}
            defaultSort="totalCost"
            onRowClick={(r) => navigate(`/teams/${encodeURIComponent(r.team)}`)}
          />
        </div>
      </div>
    </div>
  );
}
