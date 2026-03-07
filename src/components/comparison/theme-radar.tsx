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

interface ThemeRadarProps {
  firmA: FOSFirmComparisonData;
  firmB: FOSFirmComparisonData;
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

export function ThemeRadar({ firmA, firmB, split }: ThemeRadarProps) {
  const productSet = new Set<string>();
  for (const p of firmA.topProducts) productSet.add(p.product);
  for (const p of firmB.topProducts) productSet.add(p.product);

  if (productSet.size < 3) {
    return <EmptyState label="Fewer than 3 shared product categories. Radar chart requires at least 3 axes." />;
  }

  const products = Array.from(productSet);

  if (split) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{firmA.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <SingleRadar firm={firmA} color="#3b82f6" products={products} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{firmB.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <SingleRadar firm={firmB} color="#8b5cf6" products={products} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const firmAMap = new Map(firmA.topProducts.map((p) => [p.product, p.upheldRate]));
  const firmBMap = new Map(firmB.topProducts.map((p) => [p.product, p.upheldRate]));

  const data = products.map((product) => ({
    product,
    [firmA.name]: firmAMap.get(product) ?? 0,
    [firmB.name]: firmBMap.get(product) ?? 0,
  }));

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
        <Radar
          name={firmA.name}
          dataKey={firmA.name}
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.4}
        />
        <Radar
          name={firmB.name}
          dataKey={firmB.name}
          stroke="#8b5cf6"
          fill="#8b5cf6"
          fillOpacity={0.4}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
