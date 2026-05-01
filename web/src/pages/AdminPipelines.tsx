import { usePipelineStatus, useApiDrift, useHashingStatus, useTriggerPipeline } from '../api/hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { formatDate } from '../lib/formatDate';

function statusBadge(status: string) {
  const cls =
    status === 'success'
      ? 'bg-green-100 text-green-700'
      : status === 'failed'
        ? 'bg-red-100 text-red-700'
        : 'bg-gray-100 text-gray-600';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default function AdminPipelines() {
  const { data: pipelines, isLoading } = usePipelineStatus();
  const { data: drift } = useApiDrift();
  const { data: hashing } = useHashingStatus();
  const trigger = useTriggerPipeline();

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900">Pipelines</h1>

      {hashing?.m365UpnHashed && (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          M365 UPN hashing detected (as of {hashing.lastDetectedAt ? formatDate(hashing.lastDetectedAt) : 'unknown'}).
          Per-user M365 views are aggregate-only.
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Pipeline</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Last Run</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Rows</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(pipelines ?? []).map((p) => (
              <tr key={p.pipeline}>
                <td className="px-3 py-2 font-medium">{p.pipeline}</td>
                <td className="px-3 py-2 text-gray-500">
                  {p.lastRun ? formatDate(p.lastRun) : '—'}
                </td>
                <td className="px-3 py-2">{statusBadge(p.status)}</td>
                <td className="px-3 py-2 text-gray-500">{p.rowsAffected ?? '—'}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => trigger.mutate(p.pipeline)}
                    disabled={trigger.isPending}
                    className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  >
                    {trigger.isPending ? 'Running...' : 'Run Now'}
                  </button>
                </td>
              </tr>
            ))}
            {!pipelines?.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-400">
                  No pipeline runs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {trigger.isError && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Trigger failed: {String(trigger.error)}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">API Drift Log (last 50)</h2>
        {!drift?.length ? (
          <p className="text-xs text-gray-400">No drift detected</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-2 py-1 text-left font-medium text-gray-500">Source</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-500">Field</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-500">Value</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-500">Detected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {drift.map((d) => (
                  <tr key={d.id}>
                    <td className="px-2 py-1 font-medium">{d.source}</td>
                    <td className="px-2 py-1 text-gray-600">{d.fieldPath}</td>
                    <td className="px-2 py-1 text-gray-500">{d.value ?? '—'}</td>
                    <td className="px-2 py-1 text-gray-400">{formatDate(d.detectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
