'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FOSFirmDistribution, FOSOverview } from '@/lib/fos/types';
import { EmptyState } from '@/components/shared/empty-state';
import { formatNumber } from '@/lib/utils';

interface FirmConcentrationProps {
  firms: FOSFirmDistribution[];
  overview: FOSOverview;
  activeFirms: string[];
  onToggleFirm: (firm: string) => void;
}

export function FirmConcentration({ firms, overview, activeFirms, onToggleFirm }: FirmConcentrationProps) {
  if (firms.length === 0) {
    return <EmptyState label="No firm data available." />;
  }

  const top = firms.slice(0, 10);
  const denominator = Math.max(overview.totalCases, 1);
  const data = top.map((f) => ({
    name: f.firm.length > 22 ? f.firm.slice(0, 20) + '...' : f.firm,
    fullName: f.firm,
    share: Number(((f.total / denominator) * 100).toFixed(1)),
    total: f.total,
  }));

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            tickFormatter={(value) => `${Number(value ?? 0)}%`}
          />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip
            formatter={(value) => `${Number(value ?? 0)}%`}
            labelFormatter={(label) => {
              const normalizedLabel = String(label ?? '');
              const item = data.find((d) => d.name === normalizedLabel);
              return item ? `${item.fullName} (${formatNumber(item.total)} cases)` : normalizedLabel;
            }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Bar
            dataKey="share"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(_, index) => {
              if (typeof index !== 'number') return;
              const item = data[index];
              if (item) onToggleFirm(item.fullName);
            }}
          >
            {data.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={activeFirms.includes(entry.fullName) ? '#3b82f6' : '#06b6d4'}
                opacity={activeFirms.length > 0 && !activeFirms.includes(entry.fullName) ? 0.3 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
