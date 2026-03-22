'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface YearTrendChartProps {
  yearTrend: { year: number; upheldRate: number; total: number }[];
}

export function YearTrendChart({ yearTrend }: YearTrendChartProps) {
  if (yearTrend.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">Insufficient data for trend chart.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={yearTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="year" className="text-xs" />
        <YAxis yAxisId="left" orientation="left" className="text-xs" label={{ value: 'Cases', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs" label={{ value: 'Upheld %', angle: 90, position: 'insideRight', style: { fontSize: 11 } }} />
        <Tooltip
          formatter={(value, name) =>
            name === 'Upheld Rate' ? `${Number(value || 0).toFixed(1)}%` : Number(value || 0).toLocaleString()
          }
        />
        <Legend verticalAlign="top" height={30} formatter={(value: string) => <span className="text-xs">{value}</span>} />
        <Bar yAxisId="left" dataKey="total" name="Volume" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={30} />
        <Line yAxisId="right" dataKey="upheldRate" name="Upheld Rate" stroke="#f43f5e" strokeWidth={2} dot={{ fill: '#f43f5e', r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
