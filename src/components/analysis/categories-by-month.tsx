'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { EmptyState } from '@/components/shared/empty-state';
import { formatNumber } from '@/lib/utils';

interface CategoriesByMonthProps {
  monthlyProductBreakdown: { month: string; product: string; count: number }[];
  onToggleProduct?: (product: string) => void;
  activeProducts?: string[];
}

const STACK_COLORS = [
  '#7c3aed', // violet-600
  '#f97316', // orange-500
  '#3b82f6', // blue-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f43f5e', // rose-500
];

export function CategoriesByMonth({ monthlyProductBreakdown, onToggleProduct, activeProducts = [] }: CategoriesByMonthProps) {
  /* ---- determine distinct products (top 6 by total volume) ---- */
  const topProducts = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of monthlyProductBreakdown) {
      totals.set(row.product, (totals.get(row.product) || 0) + row.count);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([product]) => product);
  }, [monthlyProductBreakdown]);

  /* ---- pivot data: one row per month with product keys ---- */
  const chartData = useMemo(() => {
    const months = new Map<string, Record<string, number>>();
    for (const row of monthlyProductBreakdown) {
      if (!topProducts.includes(row.product)) continue;
      const existing = months.get(row.month) || {};
      existing[row.product] = (existing[row.product] || 0) + row.count;
      months.set(row.month, existing);
    }

    return Array.from(months.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, products]) => ({
        month,
        ...products,
      }));
  }, [monthlyProductBreakdown, topProducts]);

  if (chartData.length === 0 || topProducts.length === 0) {
    return <EmptyState label="No monthly product breakdown data available." />;
  }

  const hasActive = activeProducts.length > 0;

  return (
    <div className="h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10 }}
            stroke="#94a3b8"
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [formatNumber(Number(value)), String(name)]}
            labelFormatter={(label: unknown) => `Month: ${String(label)}`}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="square"
            iconSize={10}
          />
          {topProducts.map((product, i) => (
            <Bar
              key={product}
              dataKey={product}
              stackId="products"
              fill={STACK_COLORS[i % STACK_COLORS.length]}
              radius={i === topProducts.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
              opacity={hasActive && !activeProducts.includes(product) ? 0.3 : 1}
              onClick={onToggleProduct ? () => onToggleProduct(product) : undefined}
              style={onToggleProduct ? { cursor: 'pointer' } : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
