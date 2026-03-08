'use client';

import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { EmptyState } from '@/components/shared/empty-state';
import type { FOSYearProductOutcomeCell } from '@/lib/fos/types';
import { formatNumber, formatPercent } from '@/lib/utils';

interface ProductBubbleChartProps {
  yearProductOutcome: FOSYearProductOutcomeCell[];
  onToggleProduct?: (product: string) => void;
  activeProduct?: string | null;
}

interface BubblePoint {
  product: string;
  total: number;
  upheldRate: number;
  volume: number;
}

const BUBBLE_COLORS = [
  '#06b6d4', // cyan-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#f43f5e', // rose-500
  '#3b82f6', // blue-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
];

export function ProductBubbleChart({ yearProductOutcome, onToggleProduct, activeProduct }: ProductBubbleChartProps) {
  const data = useMemo<BubblePoint[]>(() => {
    const grouped = new Map<string, { total: number; upheld: number }>();
    for (const row of yearProductOutcome) {
      const existing = grouped.get(row.product) || { total: 0, upheld: 0 };
      existing.total += row.total;
      existing.upheld += row.upheld;
      grouped.set(row.product, existing);
    }

    return Array.from(grouped.entries())
      .map(([product, agg]) => ({
        product,
        total: agg.total,
        upheldRate: agg.total ? (agg.upheld / agg.total) * 100 : 0,
        volume: agg.total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [yearProductOutcome]);

  const zRange = useMemo<[number, number]>(() => {
    return [40, 400];
  }, []);

  if (data.length === 0) {
    return <EmptyState label="No product data available for bubble chart." />;
  }

  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            type="number"
            dataKey="total"
            name="Total cases"
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            tickFormatter={(v: number) => formatNumber(v)}
            label={{
              value: 'Total cases',
              position: 'insideBottom',
              offset: -4,
              style: { fontSize: 11, fill: '#94a3b8' },
            }}
          />
          <YAxis
            type="number"
            dataKey="upheldRate"
            name="Upheld rate"
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            domain={[0, 100]}
            label={{
              value: 'Upheld rate %',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              style: { fontSize: 11, fill: '#94a3b8' },
            }}
          />
          <ZAxis
            type="number"
            dataKey="volume"
            range={zRange}
            name="Volume"
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as BubblePoint | undefined;
              if (!point) return null;
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold text-slate-900">{point.product}</p>
                  <p className="text-slate-600">
                    {formatNumber(point.total)} cases | upheld{' '}
                    {formatPercent(point.upheldRate)}
                  </p>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            fill="#06b6d4"
            onClick={onToggleProduct ? (data: { payload?: BubblePoint }) => { if (data.payload) onToggleProduct(data.payload.product); } : undefined}
            style={onToggleProduct ? { cursor: 'pointer' } : undefined}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.product}
                fill={BUBBLE_COLORS[i % BUBBLE_COLORS.length]}
                opacity={activeProduct && activeProduct !== entry.product ? 0.3 : 0.85}
                style={onToggleProduct ? { cursor: 'pointer' } : undefined}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
