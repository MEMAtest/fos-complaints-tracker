'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import { FOSFirmComparisonData } from '@/lib/fos/types';
import { EmptyState } from '@/components/shared/empty-state';
import { formatPercent } from '@/lib/utils';

const FIRM_COLORS = ['#2563eb', '#7c3aed', '#d97706', '#059669', '#e11d48'];

interface OutcomeComparisonProps {
  firms: FOSFirmComparisonData[];
  split?: boolean;
  height?: number;
}

export function OutcomeComparison({ firms, height = 220 }: OutcomeComparisonProps) {
  if (firms.every((f) => f.totalCases === 0)) {
    return <EmptyState label="No case data available for selected firms." />;
  }

  const data = [
    {
      metric: 'Upheld %',
      ...Object.fromEntries(firms.map((f) => [f.name, Number(f.upheldRate.toFixed(1))])),
    },
    {
      metric: 'Not Upheld %',
      ...Object.fromEntries(firms.map((f) => [f.name, Number(f.notUpheldRate.toFixed(1))])),
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={6} barCategoryGap="24%" margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickFormatter={(value: number) => `${value}%`}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: unknown) => formatPercent(Number(value))}
          contentStyle={{
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
            boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} iconType="circle" />
        {firms.map((firm, i) => (
          <Bar
            key={firm.name}
            dataKey={firm.name}
            fill={FIRM_COLORS[i % FIRM_COLORS.length]}
            radius={[6, 6, 0, 0]}
            maxBarSize={44}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
