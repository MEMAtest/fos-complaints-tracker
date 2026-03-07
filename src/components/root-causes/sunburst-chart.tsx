'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
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
  // Lighten the parent color for children based on position
  const opacity = 0.45 + (0.55 * (1 - childIndex / Math.max(totalChildren, 1)));
  // Convert hex to rgba
  const r = parseInt(parentColor.slice(1, 3), 16);
  const g = parseInt(parentColor.slice(3, 5), 16);
  const b = parseInt(parentColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
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
      <ResponsiveContainer width="100%" height={380}>
        <PieChart>
          {/* Inner ring: broad categories */}
          <Pie
            data={innerData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={50}
            paddingAngle={2}
            stroke="none"
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
            innerRadius={95}
            outerRadius={145}
            paddingAngle={1}
            stroke="none"
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
          <p className="text-2xl font-semibold text-slate-900">{formatNumber(totalRootCauses)}</p>
          <p className="text-xs text-slate-500">Total Root Causes</p>
        </div>
      </div>
    </div>
  );
}
