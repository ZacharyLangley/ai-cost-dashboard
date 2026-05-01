import { useGithubModels, useAcceptanceVsCost } from '../api/hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { formatCurrency } from '../lib/formatCurrency';
import { modelColor } from '../lib/colors';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  Cell,
} from 'recharts';

export default function GitHubProductPage() {
  const { data: models, isLoading: modelsLoading } = useGithubModels();
  const { data: acceptance, isLoading: accLoading } = useAcceptanceVsCost();

  if (modelsLoading || accLoading) return <LoadingSpinner />;

  const scatterData = (acceptance ?? [])
    .filter((r) => r.acceptanceRate !== null)
    .map((r) => ({
      name: r.displayName,
      cost: r.completionsCost,
      rate: (r.acceptanceRate ?? 0) * 100,
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">GitHub Copilot</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-gray-700">Cost by Model</h2>
        <p className="mb-4 text-xs text-gray-400">Current month, GH usage only</p>
        {!models?.length ? (
          <EmptyState title="No model data" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={models} margin={{ left: 8 }}>
              <XAxis dataKey="model" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => formatCurrency(v)} tick={{ fontSize: 11 }} width={72} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="totalCost" name="Cost" radius={[4, 4, 0, 0]}>
                {models.map((m) => (
                  <Cell key={m.model} fill={modelColor(m.model)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-gray-700">Acceptance Rate vs. Cost</h2>
        <p className="mb-4 text-xs text-gray-400">
          Cost = completions (chat/PRU not included). High cost + low acceptance = poor ROI.
        </p>
        {!scatterData.length ? (
          <EmptyState title="No acceptance data" description="Requires metrics telemetry enabled in IDEs." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="cost" name="Cost" tickFormatter={(v: number) => formatCurrency(v)} tick={{ fontSize: 11 }} label={{ value: 'Cost', position: 'insideBottom', offset: -4, fontSize: 11 }} />
              <YAxis dataKey="rate" name="Acceptance %" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  const d = payload?.[0]?.payload as { name: string; cost: number; rate: number } | undefined;
                  if (!d) return null;
                  return (
                    <div className="rounded border border-gray-200 bg-white p-2 text-xs shadow">
                      <p className="font-medium">{d.name}</p>
                      <p>Cost: {formatCurrency(d.cost)}</p>
                      <p>Acceptance: {d.rate.toFixed(1)}%</p>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData} fill="#0969da" />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
