'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FOSYearTrend } from '@/lib/fos/types';
import { EmptyState } from '@/components/shared/empty-state';
import { formatNumber } from '@/lib/utils';

interface TrendChartProps {
  trends: FOSYearTrend[];
  activeYears: number[];
  onToggleYear: (year: number) => void;
}

export function TrendChart({ trends, activeYears, onToggleYear }: TrendChartProps) {
  if (trends.length === 0) {
    return <EmptyState label="No yearly trend data matches the current filters." />;
  }

  const data = trends.map((t) => ({
    year: t.year,
    total: t.total,
    upheld: t.upheld,
    notUpheld: t.notUpheld,
    partiallyUpheld: t.partiallyUpheld,
  }));

  return (
    <div className="space-y-4">
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => formatNumber(Number(v))} />
            <Tooltip
              formatter={(value: unknown, name: unknown) => [formatNumber(Number(value)), name === 'total' ? 'Total' : String(name)]}
              labelFormatter={(label: unknown) => `Year ${label}`}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#06b6d4"
              fill="url(#trendGradient)"
              strokeWidth={2}
              dot={{ r: 4, fill: '#06b6d4', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#06b6d4', cursor: 'pointer' }}
              onClick={(_d, index) => {
                if (typeof index === 'number' && data[index]) {
                  onToggleYear(data[index].year);
                }
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-2">
        {trends.map((t) => {
          const isActive = activeYears.includes(t.year);
          return (
            <button
              key={t.year}
              onClick={() => onToggleYear(t.year)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                isActive
                  ? 'border-blue-300 bg-blue-100 text-blue-700'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-blue-200'
              }`}
            >
              {t.year} ({formatNumber(t.total)})
            </button>
          );
        })}
      </div>
    </div>
  );
}
