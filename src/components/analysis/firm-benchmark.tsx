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
  LabelList,
} from 'recharts';
import { EmptyState } from '@/components/shared/empty-state';
import type { FOSFirmBenchmarkPoint } from '@/lib/fos/types';
import { formatNumber, formatPercent } from '@/lib/utils';

interface FirmBenchmarkProps {
  firmBenchmark: FOSFirmBenchmarkPoint[];
  activeFirms: string[];
  onToggleFirm: (firm: string) => void;
}

interface FirmRow {
  name: string;
  fullName: string;
  total: number;
  upheldRate: number;
  upheldLabel: string;
  predominantProduct: string | null;
}

export function FirmBenchmark({
  firmBenchmark,
  activeFirms,
  onToggleFirm,
}: FirmBenchmarkProps) {
  const data = useMemo<FirmRow[]>(() => {
    return firmBenchmark
      .slice()
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
      .map((f) => ({
        name: f.firm.length > 24 ? f.firm.slice(0, 22) + '...' : f.firm,
        fullName: f.firm,
        total: f.total,
        upheldRate: f.upheldRate,
        upheldLabel: formatPercent(f.upheldRate),
        predominantProduct: f.predominantProduct,
      }));
  }, [firmBenchmark]);

  if (data.length === 0) {
    return <EmptyState label="No firm benchmark data under current filters." />;
  }

  return (
    <div className="h-[560px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
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
            width={160}
            tick={{ fontSize: 10 }}
            stroke="#94a3b8"
          />
          <Tooltip
            formatter={(value: any) => formatNumber(Number(value))}
            labelFormatter={(label: any) => {
              const item = data.find((d) => d.name === String(label));
              if (!item) return String(label);
              const parts = [
                item.fullName,
                `upheld ${formatPercent(item.upheldRate)}`,
              ];
              if (item.predominantProduct) {
                parts.push(`top product: ${item.predominantProduct}`);
              }
              return parts.join(' | ');
            }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Bar
            dataKey="total"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(_d: any, index: any) => {
              if (typeof index === 'number' && data[index]) {
                onToggleFirm(data[index].fullName);
              }
            }}
          >
            {data.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={activeFirms.includes(entry.fullName) ? '#3b82f6' : '#06b6d4'}
                opacity={
                  activeFirms.length > 0 && !activeFirms.includes(entry.fullName) ? 0.3 : 1
                }
              />
            ))}
            <LabelList
              dataKey="upheldLabel"
              position="right"
              style={{ fontSize: 10, fill: '#64748b' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
