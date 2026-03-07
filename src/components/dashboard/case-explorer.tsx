'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FOSCaseListItem, FOSPagination } from '@/lib/fos/types';
import { OUTCOME_LABELS } from '@/lib/fos/constants';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDate, formatNumber, truncate } from '@/lib/utils';

interface CaseExplorerProps {
  cases: FOSCaseListItem[];
  pagination: FOSPagination | null;
  loading: boolean;
  error: string | null;
  onSelectCase: (caseId: string) => void;
  onPageChange: (page: number) => void;
  currentPage: number;
}

export function CaseExplorer({ cases, pagination, loading, error, onSelectCase, onPageChange, currentPage }: CaseExplorerProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Case explorer</h2>
        <p className="text-sm text-slate-500">Click a row to open full complaint, reasoning, and decision content.</p>
      </header>

      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="text-xs uppercase tracking-wider">Case</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Date</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Firm</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Product</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Outcome</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Decision logic</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((item) => (
            <TableRow
              key={item.caseId}
              onClick={() => onSelectCase(item.caseId)}
              className="cursor-pointer transition hover:bg-blue-50/60"
            >
              <TableCell className="font-medium text-slate-800">{item.decisionReference}</TableCell>
              <TableCell className="text-slate-600">{item.decisionDate ? formatDate(item.decisionDate) : 'n/a'}</TableCell>
              <TableCell className="text-slate-700">{item.firmName || 'Unknown firm'}</TableCell>
              <TableCell className="text-slate-700">{item.productGroup || 'Unspecified'}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="rounded-full">
                  {OUTCOME_LABELS[item.outcome]}
                </Badge>
              </TableCell>
              <TableCell className="text-slate-600">{truncate(item.decisionLogic || item.decisionSummary || 'n/a', 120)}</TableCell>
            </TableRow>
          ))}
          {error && (
            <TableRow>
              <TableCell colSpan={6}>
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              </TableCell>
            </TableRow>
          )}
          {loading && (
            <TableRow>
              <TableCell colSpan={6} className="py-8">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          )}
          {cases.length === 0 && !loading && !error && (
            <TableRow>
              <TableCell colSpan={6} className="py-10">
                <EmptyState label="No cases match your current filters." />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
        <p>
          {pagination
            ? `${formatNumber(pagination.total)} total matches | page ${pagination.page} of ${pagination.totalPages}`
            : 'No pagination data'}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={!pagination || pagination.page <= 1 || loading}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(pagination?.totalPages || 1, currentPage + 1))}
            disabled={!pagination || pagination.page >= pagination.totalPages || loading}
          >
            Next
          </Button>
        </div>
      </footer>
    </article>
  );
}
