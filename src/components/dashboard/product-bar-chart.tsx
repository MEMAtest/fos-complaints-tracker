'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FOSProductDistribution } from '@/lib/fos/types';
import { EmptyState } from '@/components/shared/empty-state';
import { formatNumber, formatPercent } from '@/lib/utils';

interface ProductBarChartProps {
  products: FOSProductDistribution[];
  activeProduct: string | null;
  onToggleProduct: (product: string) => void;
}

export function ProductBarChart({ products, activeProduct, onToggleProduct }: ProductBarChartProps) {
  if (products.length === 0) {
    return <EmptyState label="No products under current filters." />;
  }

  const data = products.map((p) => ({
    name: p.product.length > 20 ? p.product.slice(0, 18) + '...' : p.product,
    fullName: p.product,
    total: p.total,
    upheldRate: p.upheldRate,
  }));

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => formatNumber(Number(v))} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip
            formatter={(value: unknown) => formatNumber(Number(value))}
            labelFormatter={(label: unknown) => {
              const item = data.find((d) => d.name === String(label));
              return item ? `${item.fullName} (upheld ${formatPercent(item.upheldRate)})` : String(label);
            }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Bar
            dataKey="total"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(_d, index) => {
              if (typeof index === 'number' && data[index]) {
                onToggleProduct(data[index].fullName);
              }
            }}
          >
            {data.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={activeProduct === entry.fullName ? '#3b82f6' : '#06b6d4'}
                opacity={activeProduct && activeProduct !== entry.fullName ? 0.3 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
