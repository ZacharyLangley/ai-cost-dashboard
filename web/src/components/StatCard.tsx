interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'default' | 'warning' | 'danger' | 'success';
}

const accentClass = {
  default: 'text-gray-900',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  success: 'text-green-600',
};

export function StatCard({ label, value, sub, accent = 'default' }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass[accent]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
