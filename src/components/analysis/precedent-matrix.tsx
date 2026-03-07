'use client';

import { useMemo } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import type { FOSPrecedentRootCauseCell } from '@/lib/fos/types';
import { cn, truncate, formatNumber } from '@/lib/utils';

interface PrecedentMatrixProps {
  matrix: FOSPrecedentRootCauseCell[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
}

export function PrecedentMatrix({
  matrix,
  activeTags,
  onToggleTag,
}: PrecedentMatrixProps) {
  /* ---- top 7 precedents by total count ---- */
  const precedents = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cell of matrix) {
      counts.set(cell.precedent, (counts.get(cell.precedent) || 0) + cell.count);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 7)
      .map(([label]) => label);
  }, [matrix]);

  /* ---- top 7 root causes by total count ---- */
  const rootCauses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cell of matrix) {
      counts.set(cell.rootCause, (counts.get(cell.rootCause) || 0) + cell.count);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 7)
      .map(([label]) => label);
  }, [matrix]);

  /* ---- lookup: "precedent::rootCause" -> count ---- */
  const lookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of matrix) {
      map.set(`${cell.precedent}::${cell.rootCause}`, cell.count);
    }
    return map;
  }, [matrix]);

  /* ---- max value for intensity scaling ---- */
  const maxCount = useMemo(() => {
    let max = 0;
    for (const value of lookup.values()) max = Math.max(max, value);
    return Math.max(max, 1);
  }, [lookup]);

  if (precedents.length === 0 || rootCauses.length === 0) {
    return <EmptyState label="No precedent/root-cause matrix under this scope." />;
  }

  return (
    <div className="space-y-3">
      {/* ---- tag chips: precedents ---- */}
      <div className="flex flex-wrap gap-2">
        {precedents.map((precedent) => (
          <button
            key={`prec-${precedent}`}
            onClick={() => onToggleTag(precedent)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition',
              activeTags.includes(precedent)
                ? 'border-indigo-300 bg-indigo-100 text-indigo-800'
                : 'border-slate-300 text-slate-700 hover:border-indigo-200'
            )}
          >
            {precedent}
          </button>
        ))}
      </div>

      {/* ---- tag chips: root causes ---- */}
      <div className="flex flex-wrap gap-2">
        {rootCauses.map((rootCause) => (
          <button
            key={`rc-${rootCause}`}
            onClick={() => onToggleTag(rootCause)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition',
              activeTags.includes(rootCause)
                ? 'border-cyan-300 bg-cyan-100 text-cyan-800'
                : 'border-slate-300 text-slate-700 hover:border-cyan-200'
            )}
          >
            {rootCause}
          </button>
        ))}
      </div>

      {/* ---- intersection table ---- */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <th className="px-2 py-2">Precedent \ Root cause</th>
              {rootCauses.map((rootCause) => (
                <th key={rootCause} className="px-2 py-2 text-center">
                  {truncate(rootCause, 18)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {precedents.map((precedent) => (
              <tr key={precedent} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-2 py-2 text-xs font-medium text-slate-700">
                  {truncate(precedent, 26)}
                </td>
                {rootCauses.map((rootCause) => {
                  const key = `${precedent}::${rootCause}`;
                  const count = lookup.get(key) || 0;
                  const intensity = count > 0 ? Math.max(0.08, count / maxCount) : 0;
                  return (
                    <td key={key} className="px-2 py-2 text-center">
                      <button
                        onClick={() => onToggleTag(precedent)}
                        className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-700 transition hover:border-blue-300"
                        style={{
                          backgroundColor:
                            count > 0 ? `rgba(59,130,246,${intensity})` : undefined,
                        }}
                      >
                        {count > 0 ? formatNumber(count) : '--'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
