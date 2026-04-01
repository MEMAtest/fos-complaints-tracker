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
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Outcome breakdown</p>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">How similar published decisions actually resolved</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">This distribution shows the result mix in the comparable published set rather than only the top-line upheld rate.</p>

      <div
        className="mt-5 flex h-7 w-full overflow-hidden rounded-full border border-slate-200 bg-white"
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

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {segments.filter((s) => s.pct >= 1).map((seg) => (
          <div key={seg.outcome} className="rounded-[1.25rem] border border-slate-200 bg-[#fbfcfe] p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="font-semibold text-slate-900">{seg.label}</span>
              </div>
              <span className="font-semibold text-slate-950">{seg.pct.toFixed(1)}%</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{seg.count.toLocaleString()} published decisions in this outcome bucket.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
