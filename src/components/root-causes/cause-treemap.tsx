'use client';

import { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { EmptyState } from '@/components/shared/empty-state';
import { formatNumber } from '@/lib/utils';
import type { FOSTagCount } from '@/lib/fos/types';

interface CauseTreemapProps {
  frequency: FOSTagCount[];
}

const TREEMAP_COLORS = [
  '#0d9488', '#0891b2', '#14b8a6', '#06b6d4', '#0f766e',
  '#1e40af', '#7c3aed', '#2563eb', '#9333ea', '#3b82f6',
  '#8b5cf6', '#4f46e5', '#a855f7', '#1d4ed8', '#6d28d9',
  '#1e3a8a', '#5b21b6', '#115e59', '#1e40af', '#7c3aed',
];

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  index?: number;
}

function CustomContent({ x = 0, y = 0, width = 0, height = 0, name = '', index = 0 }: TreemapContentProps) {
  const fill = TREEMAP_COLORS[index % TREEMAP_COLORS.length];
  const showLabel = width > 50 && height > 30;
  const fontSize = width > 120 ? 12 : 10;
  const maxChars = Math.max(Math.floor(width / (fontSize * 0.6)), 4);
  const truncatedName = name.length > maxChars ? name.slice(0, maxChars - 1) + '\u2026' : name;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        ry={4}
        fill={fill}
        stroke="#fff"
        strokeWidth={2}
        style={{ opacity: 0.85 }}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={fontSize}
          fontWeight={500}
        >
          {truncatedName}
        </text>
      )}
    </g>
  );
}

export function CauseTreemap({ frequency }: CauseTreemapProps) {
  const treemapData = useMemo(() => {
    if (!frequency.length) return [];

    return frequency.map((item) => ({
      name: item.label,
      size: item.count,
    }));
  }, [frequency]);

  if (!frequency.length) {
    return <EmptyState label="No root cause frequency data available." />;
  }

  return (
    <ResponsiveContainer width="100%" height={380}>
      <Treemap
        data={treemapData}
        dataKey="size"
        nameKey="name"
        stroke="#fff"
        content={<CustomContent />}
      >
        <Tooltip
          formatter={(value: unknown) => [formatNumber(Number(value)), 'Count']}
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            fontSize: '13px',
          }}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}
