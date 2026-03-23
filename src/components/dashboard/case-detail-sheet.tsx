'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FOSCaseContext, FOSCaseDetail, FOSSimilarCase } from '@/lib/fos/types';
import { OUTCOME_LABELS } from '@/lib/fos/constants';
import { formatDate, truncate } from '@/lib/utils';
import { Loader2, Search } from 'lucide-react';

interface CaseDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseDetail: FOSCaseDetail | null;
  loading: boolean;
  error: string | null;
  onSelectCase?: (caseId: string) => void;
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

const OUTCOME_BADGE_STYLES: Record<string, string> = {
  upheld: 'border-rose-200 bg-rose-50 text-rose-700',
  not_upheld: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  partially_upheld: 'border-amber-200 bg-amber-50 text-amber-700',
  settled: 'border-blue-200 bg-blue-50 text-blue-700',
};

function SimilarDecisionsSection({ caseId, onSelectCase }: { caseId: string; onSelectCase?: (id: string) => void }) {
  const [context, setContext] = useState<FOSCaseContext | null>(null);
  const [similar, setSimilar] = useState<FOSSimilarCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggered, setTriggered] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Abort in-flight fetch on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleFindSimilar = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setTriggered(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fos/cases/${encodeURIComponent(caseId)}/similar`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load similar decisions.');
      setContext(data.data.context);
      setSimilar(data.data.cases);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [caseId]);

  if (!triggered) {
    return (
      <button
        onClick={handleFindSimilar}
        className="flex items-center gap-2 rounded-full border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
      >
        <Search className="h-4 w-4" />
        Find Similar Decisions
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Finding similar decisions...
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Context stats */}
      {context && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Decision Context</h3>
          <div className="mb-3 flex flex-wrap gap-3 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
              Product upheld rate: {context.productUpheldRate.toFixed(1)}%
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
              {context.productTotalCases.toLocaleString()} decisions in product
            </span>
          </div>
          {context.rootCauseRates.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-medium text-slate-500">Root cause upheld rates:</p>
              <div className="flex flex-wrap gap-2">
                {context.rootCauseRates.map((rc) => (
                  <span
                    key={rc.label}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      rc.upheldRate > 50
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {rc.label}: {rc.upheldRate.toFixed(0)}% ({rc.count})
                  </span>
                ))}
              </div>
            </div>
          )}
          {context.precedentRates.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Precedent frequency:</p>
              <div className="flex flex-wrap gap-2">
                {context.precedentRates.map((p) => (
                  <span key={p.label} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    {p.label}: {p.count} cases ({p.percentOfCases.toFixed(1)}%)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Similar cases */}
      {similar.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">
            Similar Decisions ({similar.length})
          </h3>
          <div className="space-y-2">
            {similar.map((c) => (
              <div
                key={c.caseId}
                onClick={() => onSelectCase?.(c.caseId)}
                className={`flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-sm transition ${onSelectCase ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-700">{c.decisionReference || c.caseId.slice(0, 8)}</span>
                    <Badge
                      variant="outline"
                      className={`rounded-full text-[10px] ${OUTCOME_BADGE_STYLES[c.outcome] || ''}`}
                    >
                      {OUTCOME_LABELS[c.outcome]}
                    </Badge>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                      Score {c.similarityScore}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {c.decisionDate ? formatDate(c.decisionDate) : '—'} · {c.firmName || 'Unknown'} · {c.productGroup || 'Unspecified'}
                  </p>
                  {c.decisionSummary && (
                    <p className="mt-1 text-xs text-slate-600">{truncate(c.decisionSummary, 120)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No similar decisions found with a high enough match score.</p>
      )}
    </div>
  );
}

export function CaseDetailSheet({ open, onOpenChange, caseDetail, loading, error, onSelectCase }: CaseDetailSheetProps) {
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

            {/* Decision context + similar decisions */}
            <section className="space-y-3">
              <SimilarDecisionsSection caseId={caseDetail.caseId} onSelectCase={onSelectCase} />
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
