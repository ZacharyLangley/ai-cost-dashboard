import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { formatMonth } from '../lib/formatDate';
import { formatCurrency } from '../lib/formatCurrency';

interface TrendChartProps {
  data: { period: string; [key: string]: number | string }[];
  lines: { key: string; color: string; label?: string }[];
  boundaries?: { date: string; label: string }[];
  height?: number;
}

export function TrendChart({ data, lines, boundaries = [], height = 240 }: TrendChartProps) {
  const june1 = [
    { date: '2025-06', label: 'PRU → AI Credits' },
    ...boundaries,
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <XAxis
          dataKey="period"
          tickFormatter={formatMonth}
          tick={{ fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrency(v)}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), '']}
          labelFormatter={(label) => formatMonth(String(label))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {june1.map((b) => (
          <ReferenceLine
            key={b.date}
            x={b.date}
            stroke="#d97706"
            strokeDasharray="4 2"
            label={{ value: b.label, position: 'insideTopRight', fontSize: 10, fill: '#d97706' }}
          />
        ))}
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label ?? l.key}
            stroke={l.color}
            dot={false}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
