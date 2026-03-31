'use client';

import type { FOSOutcomeDistribution } from '@/lib/fos/types';
import { OUTCOME_COLORS, OUTCOME_LABELS } from '@/lib/fos/constants';

interface OutcomeBreakdownProps {
  distribution: FOSOutcomeDistribution[];
  totalCases: number;
}

export function OutcomeBreakdown({ distribution, totalCases }: OutcomeBreakdownProps) {
  if (!distribution || distribution.length === 0 || totalCases === 0) return null;

  const sorted = [...distribution].sort((a, b) => b.count - a.count);
  const segments = sorted.map((d) => ({
    outcome: d.outcome,
    count: d.count,
    pct: (d.count / totalCases) * 100,
    color: OUTCOME_COLORS[d.outcome] || OUTCOME_COLORS.unknown,
    label: OUTCOME_LABELS[d.outcome] || d.outcome,
  }));

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-slate-500">Outcome breakdown</p>

      {/* Stacked bar */}
      <div
        className="flex h-6 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`Outcome breakdown: ${segments.map((s) => `${s.label} ${s.pct.toFixed(1)}%`).join(', ')}`}
      >
        {segments.map((seg) => (
          <div
            key={seg.outcome}
            className="transition-all"
            style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
            title={`${seg.label}: ${seg.count.toLocaleString()} (${seg.pct.toFixed(1)}%)`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.filter((s) => s.pct >= 1).map((seg) => (
          <div key={seg.outcome} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            {seg.label} {seg.pct.toFixed(1)}%
          </div>
        ))}
      </div>
    </div>
  );
}
