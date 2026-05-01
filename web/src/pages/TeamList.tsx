import { useNavigate } from 'react-router-dom';
import { useTeams } from '../api/hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { DataTable, type Column } from '../components/DataTable';
import { formatCurrency } from '../lib/formatCurrency';
import { useMonthFilter } from '../hooks/useMonthFilter';
import type { TeamSummary } from '../api/types';

const columns: Column<TeamSummary>[] = [
  { key: 'team', header: 'Team', sortFn: (a, b) => a.team.localeCompare(b.team) },
  {
    key: 'devCount',
    header: 'Devs',
    sortFn: (a, b) => a.devCount - b.devCount,
  },
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
    key: 'costPerDev',
    header: 'Cost/Dev',
    render: (r) => (r.devCount > 0 ? formatCurrency(r.totalCost / r.devCount) : '—'),
    sortFn: (a, b) =>
      (a.devCount > 0 ? a.totalCost / a.devCount : 0) -
      (b.devCount > 0 ? b.totalCost / b.devCount : 0),
  },
];

export default function TeamList() {
  const navigate = useNavigate();
  const { month } = useMonthFilter();
  const { data: teams, isLoading } = useTeams(month);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Teams</h1>
      {!teams?.length ? (
        <EmptyState
          title="No team data"
          description="Import an identity CSV to map developers to teams."
        />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <DataTable
            columns={columns}
            data={teams}
            defaultSort="totalCost"
            onRowClick={(r) => navigate(`/teams/${encodeURIComponent(r.team)}`)}
          />
        </div>
      )}
    </div>
  );
}
