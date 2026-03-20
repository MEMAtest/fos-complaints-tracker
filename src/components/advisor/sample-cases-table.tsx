'use client';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FOSAdvisorSampleCase } from '@/lib/fos/types';
import { formatDate, truncate } from '@/lib/utils';

const OUTCOME_BADGE_STYLES: Record<string, string> = {
  upheld: 'bg-emerald-100 text-emerald-700',
  not_upheld: 'bg-rose-100 text-rose-700',
  partially_upheld: 'bg-indigo-100 text-indigo-700',
  settled: 'bg-amber-100 text-amber-700',
  not_settled: 'bg-slate-100 text-slate-600',
  unknown: 'bg-slate-100 text-slate-600',
};

const OUTCOME_LABELS: Record<string, string> = {
  upheld: 'Upheld',
  not_upheld: 'Not upheld',
  partially_upheld: 'Partially upheld',
  settled: 'Settled',
  not_settled: 'Not settled',
  unknown: 'Unknown',
};

interface SampleCasesTableProps {
  cases: FOSAdvisorSampleCase[];
  onSelectCase: (caseId: string) => void;
}

export function SampleCasesTable({ cases, onSelectCase }: SampleCasesTableProps) {
  if (cases.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">No sample cases available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Reference</TableHead>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Firm</TableHead>
            <TableHead className="text-xs">Outcome</TableHead>
            <TableHead className="text-xs">Summary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((c) => (
            <TableRow
              key={c.caseId}
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => onSelectCase(c.caseId)}
            >
              <TableCell className="text-xs font-medium text-blue-600 hover:underline">
                {c.decisionReference || c.caseId.slice(0, 12)}
              </TableCell>
              <TableCell className="text-xs text-slate-600">
                {c.decisionDate ? formatDate(c.decisionDate) : '--'}
              </TableCell>
              <TableCell className="text-xs text-slate-600">{c.firmName || '--'}</TableCell>
              <TableCell>
                <Badge className={`rounded-full text-[10px] ${OUTCOME_BADGE_STYLES[c.outcome] || OUTCOME_BADGE_STYLES.unknown}`}>
                  {OUTCOME_LABELS[c.outcome] || 'Unknown'}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs text-xs text-slate-600">
                {c.decisionSummary ? truncate(c.decisionSummary, 120) : '--'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
