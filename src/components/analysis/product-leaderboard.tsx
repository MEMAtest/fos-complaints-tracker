'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { EmptyState } from '@/components/shared/empty-state';
import type { FOSYearProductOutcomeCell } from '@/lib/fos/types';
import { formatNumber, formatPercent } from '@/lib/utils';

interface ProductLeaderboardProps {
  yearProductOutcome: FOSYearProductOutcomeCell[];
  activeProducts: string[];
  onToggleProduct: (product: string) => void;
}

interface ProductRow {
  name: string;
  fullName: string;
  total: number;
  upheldRate: number;
}

export function ProductLeaderboard({
  yearProductOutcome,
  activeProducts,
  onToggleProduct,
}: ProductLeaderboardProps) {
  const data = useMemo<ProductRow[]>(() => {
    const grouped = new Map<string, { total: number; upheld: number }>();
    for (const row of yearProductOutcome) {
      const existing = grouped.get(row.product) || { total: 0, upheld: 0 };
      existing.total += row.total;
      existing.upheld += row.upheld;
      grouped.set(row.product, existing);
    }

    return Array.from(grouped.entries())
      .map(([product, agg]) => ({
        name: product.length > 22 ? product.slice(0, 20) + '...' : product,
        fullName: product,
        total: agg.total,
        upheldRate: agg.total ? (agg.upheld / agg.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [yearProductOutcome]);

  if (data.length === 0) {
    return <EmptyState label="No product volume data under current filters." />;
  }

  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            tickFormatter={(v: any) => formatNumber(Number(v))}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
          />
          <Tooltip
            formatter={(value: any) => formatNumber(Number(value))}
            labelFormatter={(label: any) => {
              const item = data.find((d) => d.name === String(label));
              return item
                ? `${item.fullName} (upheld ${formatPercent(item.upheldRate)})`
                : String(label);
            }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Bar
            dataKey="total"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(_d: any, index: any) => {
              if (typeof index === 'number' && data[index]) {
                onToggleProduct(data[index].fullName);
              }
            }}
          >
            {data.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={activeProducts.includes(entry.fullName) ? '#3b82f6' : '#06b6d4'}
                opacity={
                  activeProducts.length > 0 && !activeProducts.includes(entry.fullName) ? 0.3 : 1
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
