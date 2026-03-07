'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, type PieLabelRenderProps } from 'recharts';
import { EmptyState } from '@/components/shared/empty-state';
import { formatNumber } from '@/lib/utils';
import type { FOSRootCauseHierarchy } from '@/lib/fos/types';

interface SunburstChartProps {
  hierarchy: FOSRootCauseHierarchy[];
}

const CATEGORY_COLORS = [
  '#1e40af', '#7c3aed', '#0d9488', '#2563eb', '#9333ea',
  '#0891b2', '#1d4ed8', '#6d28d9', '#0f766e', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#4f46e5', '#a855f7', '#06b6d4',
];

function getChildColor(parentColor: string, childIndex: number, totalChildren: number): string {
  const opacity = 0.45 + (0.55 * (1 - childIndex / Math.max(totalChildren, 1)));
  const r = parseInt(parentColor.slice(1, 3), 16);
  const g = parseInt(parentColor.slice(3, 5), 16);
  const b = parseInt(parentColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/* Custom label renderer for the inner (category) ring */
function InnerRingLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const name = String(props.name ?? '');
  const percent = Number(props.percent ?? 0);

  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const maxLen = percent > 0.08 ? 14 : 8;
  const label = name.length > maxLen ? name.slice(0, maxLen - 1) + '\u2026' : name;

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#fff"
      fontSize={percent > 0.08 ? 10 : 9}
      fontWeight={500}
    >
      {label}
    </text>
  );
}

/* Custom label renderer for the outer (cause) ring — positioned outside the ring */
function OuterRingLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const name = String(props.name ?? '');
  const percent = Number(props.percent ?? 0);

  if (percent < 0.03) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 14;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textAnchor = midAngle > 90 && midAngle < 270 ? 'end' : 'start';
  const maxLen = 18;
  const label = name.length > maxLen ? name.slice(0, maxLen - 1) + '\u2026' : name;

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      dominantBaseline="central"
      fill="#475569"
      fontSize={9}
      fontWeight={400}
    >
      {label}
    </text>
  );
}

export function SunburstChart({ hierarchy }: SunburstChartProps) {
  const { innerData, outerData, totalRootCauses } = useMemo(() => {
    if (!hierarchy.length) return { innerData: [], outerData: [], totalRootCauses: 0 };

    const inner: { name: string; value: number; color: string }[] = [];
    const outer: { name: string; value: number; color: string; category: string }[] = [];
    let total = 0;

    hierarchy.forEach((cat, catIndex) => {
      const catTotal = cat.children.reduce((sum, child) => sum + child.value, 0);
      const parentColor = CATEGORY_COLORS[catIndex % CATEGORY_COLORS.length];

      inner.push({ name: cat.name, value: catTotal, color: parentColor });
      total += catTotal;

      cat.children.forEach((child, childIndex) => {
        outer.push({
          name: child.name,
          value: child.value,
          color: getChildColor(parentColor, childIndex, cat.children.length),
          category: cat.name,
        });
      });
    });

    return { innerData: inner, outerData: outer, totalRootCauses: total };
  }, [hierarchy]);

  if (!hierarchy.length) {
    return <EmptyState label="No root cause hierarchy data available." />;
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={480}>
        <PieChart>
          {/* Inner ring: broad categories */}
          <Pie
            data={innerData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={115}
            innerRadius={65}
            paddingAngle={2}
            stroke="none"
            label={InnerRingLabel}
            labelLine={false}
            isAnimationActive={false}
          >
            {innerData.map((entry, index) => (
              <Cell key={`inner-${index}`} fill={entry.color} />
            ))}
          </Pie>

          {/* Outer ring: specific causes */}
          <Pie
            data={outerData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={120}
            outerRadius={185}
            paddingAngle={1}
            stroke="none"
            label={OuterRingLabel}
            labelLine={false}
            isAnimationActive={false}
          >
            {outerData.map((entry, index) => (
              <Cell key={`outer-${index}`} fill={entry.color} />
            ))}
          </Pie>

          <Tooltip
            formatter={(value: unknown) => formatNumber(Number(value))}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              fontSize: '13px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-3xl font-semibold text-slate-900">{formatNumber(totalRootCauses)}</p>
          <p className="text-xs text-slate-500">Total Root Causes</p>
        </div>
      </div>
    </div>
  );
}
