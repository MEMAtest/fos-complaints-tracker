'use client';

import { Fragment, useMemo } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { cn, clamp, formatNumber } from '@/lib/utils';

interface DecisionsHeatmapProps {
  decisionDayMonthGrid: { month: number; dayOfWeek: number; count: number }[];
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DecisionsHeatmap({ decisionDayMonthGrid }: DecisionsHeatmapProps) {
  /* ---- build lookup: "month::dayOfWeek" -> count ---- */
  const lookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of decisionDayMonthGrid) {
      map.set(`${cell.month}::${cell.dayOfWeek}`, cell.count);
    }
    return map;
  }, [decisionDayMonthGrid]);

  /* ---- compute max for intensity scaling ---- */
  const maxCount = useMemo(() => {
    let max = 0;
    for (const cell of decisionDayMonthGrid) max = Math.max(max, cell.count);
    return Math.max(max, 1);
  }, [decisionDayMonthGrid]);

  if (decisionDayMonthGrid.length === 0) {
    return <EmptyState label="No decision day/month heatmap data available." />;
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `auto repeat(12, 1fr)` }}>
        {/* ---- header row: month labels ---- */}
        <div className="h-6" />
        {MONTH_LABELS.map((label, i) => (
          <div
            key={`month-${i}`}
            className="flex h-6 items-center justify-center text-[10px] font-medium text-slate-500"
          >
            {label}
          </div>
        ))}

        {/* ---- body rows: one per day of week ---- */}
        {DAY_LABELS.map((dayLabel, dayIndex) => (
          <Fragment key={`day-row-${dayIndex}`}>
            <div
              className="flex h-8 w-10 items-center justify-end pr-2 text-[10px] font-medium text-slate-500"
            >
              {dayLabel}
            </div>
            {MONTH_LABELS.map((_, monthIndex) => {
              const month = monthIndex + 1; // 1-indexed
              const dayOfWeek = dayIndex; // 0-indexed Mon=0 ... Sun=6
              const count = lookup.get(`${month}::${dayOfWeek}`) || 0;
              const intensity = count > 0 ? clamp(count / maxCount, 0.1, 1) : 0;

              return (
                <div
                  key={`cell-${month}-${dayOfWeek}`}
                  className={cn(
                    'flex h-8 items-center justify-center rounded-sm border text-[10px] font-medium transition',
                    count > 0
                      ? 'border-transparent text-white'
                      : 'border-slate-100 bg-slate-50 text-slate-400'
                  )}
                  style={
                    count > 0
                      ? { backgroundColor: `rgba(6,182,212,${intensity})` }
                      : undefined
                  }
                  title={`${DAY_LABELS[dayIndex]}, ${MONTH_LABELS[monthIndex]}: ${formatNumber(count)} decisions`}
                >
                  {count > 0 ? formatNumber(count) : ''}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      {/* ---- scale legend ---- */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-slate-500">Less</span>
        {[0.1, 0.25, 0.5, 0.75, 1].map((level) => (
          <div
            key={`legend-${level}`}
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: `rgba(6,182,212,${level})` }}
          />
        ))}
        <span className="text-[10px] text-slate-500">More</span>
      </div>
    </div>
  );
}
