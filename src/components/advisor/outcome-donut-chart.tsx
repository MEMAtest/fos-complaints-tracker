'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { OUTCOME_COLORS, OUTCOME_LABELS } from '@/lib/fos/constants';
import { FOSOutcome } from '@/lib/fos/types';

interface OutcomeDonutChartProps {
  distribution: { outcome: string; count: number }[];
}

export function OutcomeDonutChart({ distribution }: OutcomeDonutChartProps) {
  const data = distribution
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: OUTCOME_LABELS[d.outcome as FOSOutcome] || d.outcome,
      value: d.count,
      fill: OUTCOME_COLORS[d.outcome as FOSOutcome] || '#94a3b8',
    }));

  if (data.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">No outcome data available.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => Number(value || 0).toLocaleString()} />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value: string) => <span className="text-xs text-slate-600">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
