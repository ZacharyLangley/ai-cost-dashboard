import { formatCurrency } from '../lib/formatCurrency';
import { COLORS } from '../lib/colors';

interface CostBreakdownBarProps {
  ghSeats: number;
  ghUsage: number;
  m365Seats: number;
}

export function CostBreakdownBar({ ghSeats, ghUsage, m365Seats }: CostBreakdownBarProps) {
  const total = ghSeats + ghUsage + m365Seats;
  if (total === 0) return <p className="text-xs text-gray-400">No cost data</p>;

  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`;

  const segments = [
    { label: 'GH Seats', value: ghSeats, color: COLORS.ghSeats },
    { label: 'GH Usage', value: ghUsage, color: COLORS.ghUsage },
    { label: 'M365 Seats', value: m365Seats, color: COLORS.m365Seats },
  ].filter((s) => s.value > 0);

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: pct(s.value), backgroundColor: s.color }}
            title={`${s.label}: ${formatCurrency(s.value)}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}: {formatCurrency(s.value)}
          </span>
        ))}
      </div>
    </div>
  );
}
