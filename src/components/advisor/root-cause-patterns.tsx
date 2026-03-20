'use client';

import { FOSAdvisorRootCausePattern } from '@/lib/fos/types';
import { formatPercent } from '@/lib/utils';

interface RootCausePatternsProps {
  patterns: FOSAdvisorRootCausePattern[];
}

export function RootCausePatterns({ patterns }: RootCausePatternsProps) {
  if (patterns.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">No root cause patterns available.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {patterns.map((pattern) => {
        const isHigh = pattern.upheldRate > 50;
        return (
          <div
            key={pattern.label}
            className={`rounded-xl border p-3 ${isHigh ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-white'}`}
          >
            <p className="text-xs font-semibold text-slate-900 truncate">{pattern.label}</p>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">{pattern.count}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Cases</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-semibold ${isHigh ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatPercent(pattern.upheldRate)}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Upheld</p>
              </div>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${isHigh ? 'bg-rose-400' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min(pattern.upheldRate, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
