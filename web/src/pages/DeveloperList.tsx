import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevelopers, useTeams } from '../api/hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { DataTable, type Column } from '../components/DataTable';
import { formatCurrency } from '../lib/formatCurrency';
import type { DeveloperSummary } from '../api/types';

const columns: Column<DeveloperSummary>[] = [
  {
    key: 'displayName',
    header: 'Developer',
    sortFn: (a, b) => a.displayName.localeCompare(b.displayName),
  },
  { key: 'team', header: 'Team', sortFn: (a, b) => a.team.localeCompare(b.team) },
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
    key: 'm365SeatCost',
    header: 'M365 Seat',
    render: (r) => formatCurrency(r.m365SeatCost),
    sortFn: (a, b) => a.m365SeatCost - b.m365SeatCost,
  },
  {
    key: 'daysIdle',
    header: 'Status',
    render: (r) => {
      if (r.daysIdle === null) return <span className="text-gray-400">—</span>;
      if (r.daysIdle > 30)
        return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Idle {r.daysIdle}d</span>;
      return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Active</span>;
    },
    sortFn: (a, b) => (a.daysIdle ?? -1) - (b.daysIdle ?? -1),
  },
];

export default function DeveloperList() {
  const navigate = useNavigate();
  const { data: teams } = useTeams();
  const [teamFilter, setTeamFilter] = useState('');
  const { data: devs, isLoading } = useDevelopers({ team: teamFilter || undefined });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Developers</h1>
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All Teams</option>
          {teams?.map((t) => (
            <option key={t.team} value={t.team}>
              {t.team}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={devs ?? []}
          defaultSort="totalCost"
          emptyMessage="No developers found"
          onRowClick={(r) => navigate(`/developers/${encodeURIComponent(r.username)}`)}
        />
      </div>
    </div>
  );
}
