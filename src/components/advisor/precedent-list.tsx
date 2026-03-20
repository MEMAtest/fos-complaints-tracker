'use client';

import { FOSAdvisorPrecedent } from '@/lib/fos/types';

interface PrecedentListProps {
  precedents: FOSAdvisorPrecedent[];
}

export function PrecedentList({ precedents }: PrecedentListProps) {
  if (precedents.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">No precedent data available.</p>;
  }

  const maxCount = Math.max(...precedents.map((p) => p.count), 1);

  return (
    <div className="space-y-2.5">
      {precedents.map((precedent) => (
        <div key={precedent.label}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 truncate max-w-[60%]">{precedent.label}</span>
            <span className="text-slate-500">
              {precedent.count} ({precedent.percentOfCases.toFixed(1)}%)
            </span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-400 transition-all"
              style={{ width: `${(precedent.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
