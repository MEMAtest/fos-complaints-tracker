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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FOSFirmComparisonData } from '@/lib/fos/types';
import { EmptyState } from '@/components/shared/empty-state';
import { formatPercent } from '@/lib/utils';

const FIRM_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e'];

interface OutcomeComparisonProps {
  firms: FOSFirmComparisonData[];
  split?: boolean;
}

function SingleOutcomeChart({ firm, color }: { firm: FOSFirmComparisonData; color: string }) {
  const data = [
    { metric: 'Upheld %', value: firm.upheldRate },
    { metric: 'Not Upheld %', value: firm.notUpheldRate },
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickFormatter={(value: number) => `${value}%`}
        />
        <Tooltip
          formatter={(value: unknown) => formatPercent(Number(value))}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
        />
        <Bar dataKey="value" name={firm.name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={60} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OutcomeComparison({ firms, split }: OutcomeComparisonProps) {
  if (firms.every((f) => f.totalCases === 0)) {
    return <EmptyState label="No case data available for selected firms." />;
  }

  if (split) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {firms.map((firm, i) => (
          <Card key={firm.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{firm.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <SingleOutcomeChart firm={firm} color={FIRM_COLORS[i % FIRM_COLORS.length]} />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const data = [
    {
      metric: 'Upheld %',
      ...Object.fromEntries(firms.map((f) => [f.name, f.upheldRate])),
    },
    {
      metric: 'Not Upheld %',
      ...Object.fromEntries(firms.map((f) => [f.name, f.notUpheldRate])),
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
        {firms.map((firm, i) => (
          <Bar
            key={firm.name}
            dataKey={firm.name}
            fill={FIRM_COLORS[i % FIRM_COLORS.length]}
            radius={[4, 4, 0, 0]}
            maxBarSize={60}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
