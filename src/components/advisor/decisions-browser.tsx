'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FOSAdvisorSampleCase } from '@/lib/fos/types';
import { OUTCOME_LABELS } from '@/lib/fos/constants';
import { formatDate, truncate } from '@/lib/utils';

const OUTCOME_BADGE_STYLES: Record<string, string> = {
  upheld: 'border-rose-200 bg-rose-50 text-rose-700',
  not_upheld: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  partially_upheld: 'border-amber-200 bg-amber-50 text-amber-700',
  settled: 'border-blue-200 bg-blue-50 text-blue-700',
};

const PAGE_SIZE = 10;

interface DecisionsBrowserProps {
  cases: FOSAdvisorSampleCase[];
  onSelectCase: (caseId: string) => void;
}

export function DecisionsBrowser({ cases, onSelectCase }: DecisionsBrowserProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(cases.length / PAGE_SIZE));
  const visible = cases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (cases.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">No sample decisions available.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          {cases.length} sample decisions
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Firm</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">Summary</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr
                key={c.caseId}
                onClick={() => onSelectCase(c.caseId)}
                className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
              >
                <td className="px-3 py-2.5 font-medium text-blue-700">
                  {c.decisionReference || c.caseId.slice(0, 8)}
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {c.decisionDate ? formatDate(c.decisionDate) : '—'}
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {truncate(c.firmName || 'Unknown', 28)}
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    variant="outline"
                    className={`rounded-full text-[11px] ${OUTCOME_BADGE_STYLES[c.outcome] || ''}`}
                  >
                    {OUTCOME_LABELS[c.outcome as keyof typeof OUTCOME_LABELS] || c.outcome}
                  </Badge>
                </td>
                <td className="max-w-[300px] px-3 py-2.5 text-slate-600">
                  {truncate(c.decisionSummary || '—', 80)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
