'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FOSCaseListItem, FOSDashboardFilters, FOSPagination } from '@/lib/fos/types';
import { OUTCOME_LABELS } from '@/lib/fos/constants';
import { formatDate, truncate } from '@/lib/utils';
import { useSubsetCases } from '@/hooks/use-fos-analysis';

const OUTCOME_BADGE_STYLES: Record<string, string> = {
  upheld: 'border-rose-200 bg-rose-50 text-rose-700',
  not_upheld: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  partially_upheld: 'border-amber-200 bg-amber-50 text-amber-700',
  settled: 'border-blue-200 bg-blue-50 text-blue-700',
  not_settled: 'border-slate-200 bg-slate-50 text-slate-600',
  unknown: 'border-slate-200 bg-slate-50 text-slate-600',
};

interface SubsetDecisionsTableProps {
  filters: FOSDashboardFilters;
  totalCases: number;
  onSelectCase: (caseId: string) => void;
}

export function SubsetDecisionsTable({ filters, totalCases, onSelectCase }: SubsetDecisionsTableProps) {
  const { cases, pagination, loading, error, fetchSubsetCases, reset } = useSubsetCases();
  const [page, setPage] = useState(1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setPage(1);
    setVisible(false);
    reset();
  }, [filters, reset]);

  const handleShowCases = useCallback(() => {
    setVisible(true);
    void fetchSubsetCases(filters, 1);
  }, [filters, fetchSubsetCases]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      void fetchSubsetCases(filters, newPage);
    },
    [filters, fetchSubsetCases]
  );

  if (!visible) {
    return (
      <div className="flex items-center justify-center py-4">
        <button
          onClick={handleShowCases}
          disabled={totalCases === 0}
          className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Browse {totalCases > 0 ? `${totalCases.toLocaleString()} ` : ''}Matching Decisions
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Matching Decisions
          {pagination && (
            <span className="ml-2 font-normal text-slate-500">
              ({pagination.total.toLocaleString()} total)
            </span>
          )}
        </h3>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= pagination.totalPages || loading}
              className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      )}

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && cases.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Firm</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
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
                    {truncate(c.firmName || 'Unknown', 30)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {truncate(c.productGroup || 'Unspecified', 25)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge
                      variant="outline"
                      className={`rounded-full text-[11px] ${OUTCOME_BADGE_STYLES[c.outcome] || OUTCOME_BADGE_STYLES.unknown}`}
                    >
                      {OUTCOME_LABELS[c.outcome]}
                    </Badge>
                  </td>
                  <td className="max-w-[300px] px-3 py-2.5 text-slate-600">
                    {truncate(c.decisionSummary || c.decisionLogic || '—', 80)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && cases.length === 0 && !error && (
        <p className="py-4 text-center text-sm text-slate-500">No decisions found for current filters.</p>
      )}
    </div>
  );
}
