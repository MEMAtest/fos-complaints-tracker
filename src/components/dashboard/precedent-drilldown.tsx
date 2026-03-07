'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FOSTagCount } from '@/lib/fos/types';
import { EmptyState } from '@/components/shared/empty-state';
import { formatNumber } from '@/lib/utils';

interface PrecedentDrilldownProps {
  title: string;
  items: FOSTagCount[];
  activeTag: string | null;
  onToggle: (tag: string) => void;
}

export function PrecedentDrilldown({ title, items, activeTag, onToggle }: PrecedentDrilldownProps) {
  if (items.length === 0) {
    return <EmptyState label={`No ${title.toLowerCase()} for this scope.`} />;
  }

  const data = items.slice(0, 8).map((item) => ({
    name: item.label.length > 20 ? item.label.slice(0, 18) + '...' : item.label,
    fullName: item.label,
    count: item.count,
  }));

  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => formatNumber(Number(v))} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <Tooltip
              formatter={(value: unknown) => formatNumber(Number(value))}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(_d, index) => {
                if (typeof index === 'number' && data[index]) {
                  onToggle(data[index].fullName);
                }
              }}
            >
              {data.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={activeTag === entry.fullName ? '#3b82f6' : '#06b6d4'}
                  opacity={activeTag && activeTag !== entry.fullName ? 0.3 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
