'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { FOSFirmComparisonData } from '@/lib/fos/types';
import { EmptyState } from '@/components/shared/empty-state';
import { formatPercent } from '@/lib/utils';

export const COMPARISON_FIRM_COLORS = ['#2563eb', '#7c3aed', '#d97706', '#059669', '#e11d48'];

interface FirmTrendChartProps {
  firms: FOSFirmComparisonData[];
  height?: number;
}

export function FirmTrendChart({ firms, height = 220 }: FirmTrendChartProps) {
  const yearSet = new Set<number>();
  for (const firm of firms) {
    for (const row of firm.yearBreakdown) {
      yearSet.add(row.year);
    }
  }

  const years = Array.from(yearSet).sort((a, b) => a - b);
  if (years.length === 0) {
    return <EmptyState label="No multi-year trend data available for selected firms." />;
  }

  const maps = firms.map((firm) => new Map(firm.yearBreakdown.map((y) => [y.year, y.upheldRate])));
  const data = years.map((year) => {
    const point: Record<string, number | string | null> = { year: String(year) };
    firms.forEach((firm, idx) => {
      const val = maps[idx].get(year);
      point[firm.name] = typeof val === 'number' ? Number(val.toFixed(1)) : null;
    });
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickFormatter={(value: number) => `${value}%`}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: unknown) => (value == null ? '—' : formatPercent(Number(value)))}
          contentStyle={{
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
            boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} iconType="circle" />
        {firms.map((firm, i) => (
          <Line
            key={firm.name}
            type="monotone"
            dataKey={firm.name}
            stroke={COMPARISON_FIRM_COLORS[i % COMPARISON_FIRM_COLORS.length]}
            strokeWidth={2.5}
            dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
