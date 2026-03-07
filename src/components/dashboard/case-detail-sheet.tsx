'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FOSCaseDetail } from '@/lib/fos/types';
import { OUTCOME_LABELS } from '@/lib/fos/constants';
import { formatDate, truncate } from '@/lib/utils';

interface CaseDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseDetail: FOSCaseDetail | null;
  loading: boolean;
  error: string | null;
}

function SectionSourceBadge({ source, confidence }: { source: 'stored' | 'inferred' | 'missing'; confidence?: number }) {
  const styles =
    source === 'stored'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : source === 'inferred'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-slate-100 text-slate-600';
  const label = source === 'stored' ? 'stored extract' : source === 'inferred' ? 'inferred extract' : 'missing';

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}>
      {label}
      {confidence != null ? ` · ${Math.round(confidence * 100)}%` : ''}
    </span>
  );
}

function DetailBlock({
  title,
  text,
  source,
  confidence,
}: {
  title: string;
  text: string;
  source?: 'stored' | 'inferred' | 'missing';
  confidence?: number;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {source && <SectionSourceBadge source={source} confidence={confidence} />}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{text}</p>
    </section>
  );
}

function TagCluster({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length === 0 ? (
          <span className="text-xs text-slate-500">No tags extracted.</span>
        ) : (
          values.map((value) => (
            <Badge key={`${title}-${value}`} variant="outline" className="rounded-full">
              {value}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}

export function CaseDetailSheet({ open, onOpenChange, caseDetail, loading, error }: CaseDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{caseDetail?.decisionReference || 'Case Detail'}</SheetTitle>
          <SheetDescription>
            {caseDetail
              ? `${caseDetail.decisionDate ? formatDate(caseDetail.decisionDate) : 'Date unavailable'} | ${caseDetail.firmName || 'Unknown firm'} | ${caseDetail.productGroup || 'Unspecified'}`
              : 'Loading case information...'}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="mt-4 space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        {caseDetail && (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full">
                {OUTCOME_LABELS[caseDetail.outcome]}
              </Badge>
              {caseDetail.pdfUrl && (
                <a href={caseDetail.pdfUrl} target="_blank" rel="noreferrer">
                  <Badge variant="outline" className="cursor-pointer rounded-full border-blue-200 bg-blue-50 text-blue-700">
                    Open PDF
                  </Badge>
                </a>
              )}
              {caseDetail.sourceUrl && (
                <a href={caseDetail.sourceUrl} target="_blank" rel="noreferrer">
                  <Badge variant="outline" className="cursor-pointer rounded-full border-cyan-200 bg-cyan-50 text-cyan-700">
                    Source page
                  </Badge>
                </a>
              )}
            </div>

            <DetailBlock title="Decision logic" text={caseDetail.decisionLogic || caseDetail.decisionSummary || 'Not available.'} />
            <DetailBlock
              title="The complaint"
              text={caseDetail.complaintText || 'Section unavailable.'}
              source={caseDetail.sectionSources.complaint}
              confidence={caseDetail.sectionConfidence.complaint}
            />
            <DetailBlock
              title="Firm response"
              text={caseDetail.firmResponseText || 'Section unavailable.'}
              source={caseDetail.sectionSources.firmResponse}
              confidence={caseDetail.sectionConfidence.firmResponse}
            />
            <DetailBlock
              title="Ombudsman reasoning"
              text={caseDetail.ombudsmanReasoningText || 'Section unavailable.'}
              source={caseDetail.sectionSources.ombudsmanReasoning}
              confidence={caseDetail.sectionConfidence.ombudsmanReasoning}
            />
            <DetailBlock
              title="Final decision"
              text={caseDetail.finalDecisionText || 'Section unavailable.'}
              source={caseDetail.sectionSources.finalDecision}
              confidence={caseDetail.sectionConfidence.finalDecision}
            />
            {caseDetail.fullText && (
              <DetailBlock title="Source text preview" text={truncate(caseDetail.fullText, 2500)} />
            )}

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Smart tags</h3>
              <div className="mt-3 space-y-3">
                <TagCluster title="Precedents" values={caseDetail.precedents} />
                <TagCluster title="Root causes" values={caseDetail.rootCauseTags} />
                <TagCluster title="Vulnerability flags" values={caseDetail.vulnerabilityFlags} />
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
