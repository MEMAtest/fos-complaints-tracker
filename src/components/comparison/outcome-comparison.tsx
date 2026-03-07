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

interface OutcomeComparisonProps {
  firmA: FOSFirmComparisonData;
  firmB: FOSFirmComparisonData;
}

export function OutcomeComparison({ firmA, firmB }: OutcomeComparisonProps) {
  if (firmA.totalCases === 0 && firmB.totalCases === 0) {
    return <EmptyState label="No case data available for either firm." />;
  }

  const data = [
    {
      metric: 'Upheld %',
      [firmA.name]: firmA.upheldRate,
      [firmB.name]: firmB.upheldRate,
    },
    {
      metric: 'Not Upheld %',
      [firmA.name]: firmA.notUpheldRate,
      [firmB.name]: firmB.notUpheldRate,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} barGap={8} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickFormatter={(value: number) => `${value}%`}
        />
        <Tooltip
          formatter={(value: unknown) => formatPercent(Number(value))}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Bar
          dataKey={firmA.name}
          fill="#06b6d4"
          radius={[4, 4, 0, 0]}
          maxBarSize={60}
        />
        <Bar
          dataKey={firmB.name}
          fill="#8b5cf6"
          radius={[4, 4, 0, 0]}
          maxBarSize={60}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
