'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, type PieLabelRenderProps } from 'recharts';
import { EmptyState } from '@/components/shared/empty-state';
import { formatNumber } from '@/lib/utils';
import type { FOSRootCauseHierarchy } from '@/lib/fos/types';

interface SunburstChartProps {
  hierarchy: FOSRootCauseHierarchy[];
  onToggleTag?: (tag: string) => void;
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

  // For small segments show percentage instead of truncated name
  if (percent < 0.08) {
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={9}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  }

  const maxLen = 14;
  const label = name.length > maxLen ? name.slice(0, maxLen - 1) + '\u2026' : name;

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#fff"
      fontSize={10}
      fontWeight={600}
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
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textAnchor = midAngle > 90 && midAngle < 270 ? 'end' : 'start';
  const maxLen = 26;
  const label = name.length > maxLen ? name.slice(0, maxLen - 1) + '\u2026' : name;

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      dominantBaseline="central"
      fill="#475569"
      fontSize={percent > 0.05 ? 11 : 10}
      fontWeight={400}
    >
      {label}
    </text>
  );
}

/* Custom tooltip with percentage */
function SunburstTooltip({ active, payload, totalRootCauses }: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; category?: string } }>;
  totalRootCauses: number;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const pct = totalRootCauses > 0 ? ((item.value / totalRootCauses) * 100).toFixed(1) : '0';
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{item.name}</p>
      {item.category && <p className="text-slate-500">Category: {item.category}</p>}
      <p className="text-slate-600">{formatNumber(item.value)} ({pct}%)</p>
    </div>
  );
}

export function SunburstChart({ hierarchy, onToggleTag }: SunburstChartProps) {
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
      <ResponsiveContainer width="100%" height={420}>
        <PieChart margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
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
            onClick={onToggleTag ? (data: { name?: string }) => { if (data.name) onToggleTag(data.name); } : undefined}
            style={onToggleTag ? { cursor: 'pointer' } : undefined}
          >
            {innerData.map((entry, index) => (
              <Cell key={`inner-${index}`} fill={entry.color} style={onToggleTag ? { cursor: 'pointer' } : undefined} />
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
            onClick={onToggleTag ? (data: { name?: string }) => { if (data.name) onToggleTag(data.name); } : undefined}
            style={onToggleTag ? { cursor: 'pointer' } : undefined}
          >
            {outerData.map((entry, index) => (
              <Cell key={`outer-${index}`} fill={entry.color} style={onToggleTag ? { cursor: 'pointer' } : undefined} />
            ))}
          </Pie>

          <Tooltip
            content={<SunburstTooltip totalRootCauses={totalRootCauses} />}
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

      {/* Category legend */}
      {innerData.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 px-2 md:grid-cols-3">
          {innerData.map((cat) => {
            const pct = totalRootCauses > 0 ? ((cat.value / totalRootCauses) * 100).toFixed(1) : '0';
            return (
              <button
                key={cat.name}
                onClick={() => onToggleTag?.(cat.name)}
                className="flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs text-slate-700 transition hover:bg-slate-100"
              >
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cat.color }} />
                <span className="truncate">{cat.name}</span>
                <span className="ml-auto shrink-0 tabular-nums text-slate-400">{pct}%</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
