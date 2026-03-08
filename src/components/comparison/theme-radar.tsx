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
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FOSFirmComparisonData } from '@/lib/fos/types';
import { EmptyState } from '@/components/shared/empty-state';
import { formatPercent } from '@/lib/utils';

const FIRM_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e'];

interface ThemeRadarProps {
  firms: FOSFirmComparisonData[];
  split?: boolean;
}

function SingleRadar({ firm, color, products }: { firm: FOSFirmComparisonData; color: string; products: string[] }) {
  const firmMap = new Map(firm.topProducts.map((p) => [p.product, p.upheldRate]));
  const data = products.map((product) => ({
    product,
    value: firmMap.get(product) ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="product" tick={{ fontSize: 10, fill: '#64748b' }} />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickFormatter={(value: number) => `${value}%`}
        />
        <Tooltip
          formatter={(value: unknown) => formatPercent(Number(value))}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
        />
        <Radar name={firm.name} dataKey="value" stroke={color} fill={color} fillOpacity={0.4} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function ThemeRadar({ firms, split }: ThemeRadarProps) {
  const productSet = new Set<string>();
  for (const firm of firms) {
    for (const p of firm.topProducts) productSet.add(p.product);
  }

  if (productSet.size < 3) {
    return <EmptyState label="Fewer than 3 shared product categories. Radar chart requires at least 3 axes." />;
  }

  const products = Array.from(productSet);

  if (split) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {firms.map((firm, i) => (
          <Card key={firm.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{firm.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <SingleRadar firm={firm} color={FIRM_COLORS[i % FIRM_COLORS.length]} products={products} />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const firmMaps = firms.map((firm) => new Map(firm.topProducts.map((p) => [p.product, p.upheldRate])));

  const data = products.map((product) => {
    const row: Record<string, string | number> = { product };
    firms.forEach((firm, i) => {
      row[firm.name] = firmMaps[i].get(product) ?? 0;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={360}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="product"
          tick={{ fontSize: 10, fill: '#64748b' }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
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
          <Radar
            key={firm.name}
            name={firm.name}
            dataKey={firm.name}
            stroke={FIRM_COLORS[i % FIRM_COLORS.length]}
            fill={FIRM_COLORS[i % FIRM_COLORS.length]}
            fillOpacity={0.25}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}
