'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { FOSFirmComparisonData } from '@/lib/fos/types';
import { EmptyState } from '@/components/shared/empty-state';
import { formatPercent } from '@/lib/utils';

const FIRM_COLORS = ['#2563eb', '#7c3aed', '#d97706', '#059669', '#e11d48'];

interface ThemeRadarProps {
  firms: FOSFirmComparisonData[];
  split?: boolean;
  height?: number;
}

function shortLabel(name: string): string {
  return name.length > 18 ? `${name.slice(0, 16)}…` : name;
}

export function ThemeRadar({ firms, height = 220 }: ThemeRadarProps) {
  const productTotals = new Map<string, number>();
  for (const firm of firms) {
    for (const p of firm.topProducts) {
      productTotals.set(p.product, (productTotals.get(p.product) || 0) + p.total);
    }
  }

  const products = Array.from(productTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([product]) => product);

  if (products.length === 0) {
    return <EmptyState label="No product breakdown available for selected firms." />;
  }

  const firmMaps = firms.map((firm) => new Map(firm.topProducts.map((p) => [p.product, Number(p.upheldRate.toFixed(1))])));

  const data = products.map((product) => {
    const row: Record<string, string | number> = {
      product: shortLabel(product),
      fullProduct: product,
    };
    firms.forEach((firm, i) => {
      row[firm.name] = firmMaps[i].get(product) ?? 0;
    });
    return row;
  });

  // Graceful horizontal bar fallback when fewer than 3 product categories exist
  if (products.length < 3) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="product" width={110} tick={{ fontSize: 10, fill: '#475569' }} />
          <Tooltip
            formatter={(value: unknown) => formatPercent(Number(value))}
            contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} iconType="circle" />
          {firms.map((firm, i) => (
            <Bar key={firm.name} dataKey={firm.name} fill={FIRM_COLORS[i % FIRM_COLORS.length]} radius={[0, 4, 4, 0]} maxBarSize={20} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart cx="50%" cy="48%" outerRadius="68%" data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="product" tick={{ fontSize: 10, fill: '#475569' }} />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 9, fill: '#94a3b8' }}
          tickFormatter={(value: number) => `${value}%`}
        />
        <Tooltip
          formatter={(value: unknown) => formatPercent(Number(value))}
          contentStyle={{
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
            boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '11px' }} iconType="circle" />
        {firms.map((firm, i) => (
          <Radar
            key={firm.name}
            name={firm.name}
            dataKey={firm.name}
            stroke={FIRM_COLORS[i % FIRM_COLORS.length]}
            fill={FIRM_COLORS[i % FIRM_COLORS.length]}
            fillOpacity={0.22}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}
