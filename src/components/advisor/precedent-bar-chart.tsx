'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface PrecedentBarChartProps {
  precedents: { label: string; count: number; percentOfCases: number }[];
}

export function PrecedentBarChart({ precedents }: PrecedentBarChartProps) {
  if (precedents.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">No precedent data available.</p>;
  }

  const data = precedents.slice(0, 8).map((p) => ({
    name: p.label.length > 18 ? p.label.slice(0, 15) + '...' : p.label,
    fullName: p.label,
    count: p.count,
    pct: p.percentOfCases,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
        <XAxis type="number" className="text-xs" />
        <YAxis type="category" dataKey="name" width={100} className="text-xs" tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value, _name, props) => [
            `${Number(value || 0)} cases (${Number((props?.payload as { pct?: number } | undefined)?.pct || 0).toFixed(1)}%)`,
            String((props?.payload as { fullName?: string } | undefined)?.fullName || ''),
          ]}
        />
        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
