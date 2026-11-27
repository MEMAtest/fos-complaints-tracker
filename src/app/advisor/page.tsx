'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileText,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { CaseDetailSheet } from '@/components/dashboard/case-detail-sheet';
import { useCaseDetail } from '@/hooks/use-fos-dashboard';
import { useFosAdvisor } from '@/hooks/use-fos-advisor';
import { AdvisorInputForm } from '@/components/advisor/advisor-input-form';
import { PrecedentList } from '@/components/advisor/precedent-list';
import { ThemeCard } from '@/components/advisor/theme-card';
import { ActionChecklist } from '@/components/advisor/action-checklist';
import { OutcomeDonutChart } from '@/components/advisor/outcome-donut-chart';
import { YearTrendChart } from '@/components/advisor/year-trend-chart';
import { PrecedentBarChart } from '@/components/advisor/precedent-bar-chart';
import { DecisionsBrowser } from '@/components/advisor/decisions-browser';
import { cn, formatDate, formatNumber, formatPercent } from '@/lib/utils';
import { MarketingHeader } from '@/components/marketing/marketing-header';

type BottomTab = 'decisions' | 'signals' | 'narrative' | 'actions';

type AdvisorModalState =
  | null
  | { title: string; eyebrow: string; body: string; bullets?: string[] };

function useAdvisorDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;
    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    const onDown = (e: PointerEvent) => { pressedOutside = isOutside(e); };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) dialog.close();
      pressedOutside = false;
    };
    if (!supportsClosedBy) {
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
    }
    return () => {
      dialog.removeEventListener('close', handleClose);
      if (!supportsClosedBy) {
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      }
    };
  }, [onClose]);

  return ref;
}

export default function AdvisorPage() {
  const { brief, loading, error, options, optionsLoading, fetchBrief, fetchOptions } = useFosAdvisor();
  const { selectedCaseId, setSelectedCaseId, selectedCase, caseLoading, caseError } = useCaseDetail();
  const [hasQueried, setHasQueried] = useState(false);
  const [initialQuery, setInitialQuery] = useState({ product: '', rootCause: '' });
  const [bottomTab, setBottomTab] = useState<BottomTab>('decisions');
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});
  const [modal, setModal] = useState<AdvisorModalState>(null);

  const loadedDeepLinkRef = useRef('');
  const didAutoSeedRef = useRef(false);

  const closeModal = useCallback(() => setModal(null), []);
  const modalRef = useAdvisorDialog(modal !== null, closeModal);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const product = String(params.get('product') || '').trim();
    const rootCause = String(params.get('rootCause') || '').trim();
    if (product || rootCause) setInitialQuery({ product, rootCause });
  }, []);

  // Load deep link OR auto-load a default high-volume brief so the dashboard is immediately alive
  useEffect(() => {
    if (optionsLoading || !options?.products.length) return;

    if (initialQuery.product && options.products.includes(initialQuery.product)) {
      const rootCause = initialQuery.rootCause && options.rootCauses.includes(initialQuery.rootCause)
        ? initialQuery.rootCause
        : null;
      const queryKey = `${initialQuery.product}\u0000${rootCause || ''}`;
      if (loadedDeepLinkRef.current === queryKey) return;
      loadedDeepLinkRef.current = queryKey;
      didAutoSeedRef.current = true;
      setHasQueried(true);
      void fetchBrief({ product: initialQuery.product, rootCause, freeText: null });
      return;
    }

    if (!didAutoSeedRef.current && !hasQueried) {
      didAutoSeedRef.current = true;
      const defaultProduct =
        options.products.find((p) => p === 'Banking and Payments') ||
        options.products.find((p) => p === 'Banking and credit') ||
        options.products[0];
      if (defaultProduct) {
        setInitialQuery({ product: defaultProduct, rootCause: '' });
        setHasQueried(true);
        void fetchBrief({ product: defaultProduct, rootCause: null, freeText: null });
      }
    }
  }, [fetchBrief, hasQueried, initialQuery, options, optionsLoading]);

  const handleSubmit = (product: string, rootCause: string | null, freeText: string | null) => {
    setHasQueried(true);
    setCheckedActions({});
    void fetchBrief({ product, rootCause, freeText });
  };

  const risk = brief?.riskAssessment;
  const upheldDelta = risk ? risk.upheldRate - risk.overallUpheldRate : 0;
  const topDriver = brief?.rootCausePatterns?.[0];
  const confidenceScore = useMemo(() => {
    if (!risk) return { pct: 0, label: 'Low' };
    if (risk.sampleSize >= 500) return { pct: 95, label: 'High' };
    if (risk.sampleSize >= 150) return { pct: 86, label: 'High' };
    if (risk.sampleSize >= 50) return { pct: 74, label: 'Medium' };
    return { pct: 58, label: 'Indicative' };
  }, [risk]);

  const maxRootCauseCount = useMemo(
    () => Math.max(1, ...(brief?.rootCausePatterns?.slice(0, 6).map((r) => r.count) || [1])),
    [brief]
  );

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-950">
      <MarketingHeader />
      <main className="relative pb-10">
        {loading && (
          <div className="sticky top-0 z-40 h-1 w-full overflow-hidden bg-blue-100/80">
            <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-[#0f1f4f] to-[#e2b12f]" />
          </div>
        )}

        <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
          {/* Header + Compact Selector */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0f1f4f]/70">Intelligence Brief</p>
                <h1 className="text-2xl font-semibold tracking-tight text-[#08162f] md:text-3xl">Complaint Advisor</h1>
              </div>
              {brief && (
                <p className="text-xs text-slate-500">
                  Data through {brief.dataThrough ? formatDate(brief.dataThrough) : 'latest sync'} · {formatNumber(brief.riskAssessment.sampleSize)} matching decisions
                </p>
              )}
            </div>

            <AdvisorInputForm
              products={options?.products || []}
              rootCauses={options?.rootCauses || []}
              loading={loading}
              optionsLoading={optionsLoading}
              initialProduct={initialQuery.product}
              initialRootCause={initialQuery.rootCause}
              onRetryOptions={fetchOptions}
              onSubmit={handleSubmit}
            />
          </section>

          {error && (
            <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
              {error}
            </section>
          )}

          {loading && !brief && (
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </section>
          )}

          {!loading && hasQueried && !brief && !error && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
              No intelligence brief is available for this combination yet. Try selecting a broader product sector above.
            </section>
          )}

          {brief && risk && !loading && (
            <>
              {/* 1. Compact Executive Summary Strip */}
              <section className="grid items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm lg:grid-cols-[0.8fr_1fr_1fr_1fr]">
                <div>
                  <p className="text-xs font-semibold text-[#08162f]">Executive Summary</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {brief.query.product}{brief.query.rootCause ? ` · ${brief.query.rootCause}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      title: 'Upheld Rate vs Corpus Benchmark',
                      eyebrow: 'Executive Takeaway',
                      body: `The upheld rate for ${brief.query.product} is ${formatPercent(risk.upheldRate)} compared with the overall published FOS benchmark of ${formatPercent(risk.overallUpheldRate)} (${upheldDelta >= 0 ? '+' : ''}${upheldDelta.toFixed(1)} pp).`,
                    })
                  }
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition hover:shadow-sm',
                    upheldDelta > 2 ? 'border-rose-200 bg-rose-50/70' : 'border-emerald-200 bg-emerald-50/70'
                  )}
                >
                  <TrendingUp className={cn('h-4 w-4 shrink-0', upheldDelta > 2 ? 'text-rose-600' : 'text-emerald-600')} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#08162f]">
                      Upheld rate {upheldDelta >= 0 ? '+' : ''}{upheldDelta.toFixed(1)} pp vs corpus
                    </p>
                    <p className="truncate text-[11px] text-slate-600">At {formatPercent(risk.upheldRate)} ({risk.trendDirection})</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      title: 'Published Decision Volume',
                      eyebrow: 'Sample Depth',
                      body: `${formatNumber(risk.sampleSize)} published FOS decisions underpin this intelligence brief (risk level: ${risk.upholdRiskLevel.replace('_', ' ')}).`,
                    })
                  }
                  className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-left transition hover:shadow-sm"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#08162f]">
                      {formatNumber(risk.sampleSize)} published cases
                    </p>
                    <p className="truncate text-[11px] text-slate-600">Risk band: {risk.upholdRiskLevel.replace('_', ' ')}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      title: 'Primary Complaint Driver',
                      eyebrow: 'Key Root Cause',
                      body: topDriver
                        ? `"${topDriver.label}" is the most frequent root cause in this slice (${formatNumber(topDriver.count)} cases, ${formatPercent(topDriver.upheldRate)} upheld).`
                        : 'Root cause drivers are distributed across multiple categories.',
                    })
                  }
                  className="flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-left transition hover:shadow-sm"
                >
                  <Target className="h-4 w-4 shrink-0 text-violet-700" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#08162f]">
                      {topDriver ? `Driver: ${topDriver.label}` : 'Multiple drivers'}
                    </p>
                    <p className="truncate text-[11px] text-slate-600">
                      {topDriver ? `${formatNumber(topDriver.count)} cases · ${formatPercent(topDriver.upheldRate)} upheld` : 'Click for summary'}
                    </p>
                  </div>
                </button>
              </section>

              {/* 2. 4 Clickable KPI Cards + Outcome Distribution Donut in ONE Row */}
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      title: 'Complaint Volume & Coverage',
                      eyebrow: 'KPI Detail',
                      body: `This brief analyses ${formatNumber(risk.sampleSize)} published decisions out of ${formatNumber(risk.totalCases)} total records for ${brief.query.product}.`,
                    })
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0f1f4f]/30 hover:shadow-md"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <FileText className="h-3.5 w-3.5 text-[#0f1f4f]" aria-hidden="true" />
                    Complaint volume
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[#08162f]">{formatNumber(risk.sampleSize)}</p>
                  <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    Published corpus
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      title: 'Upheld Rate Benchmark',
                      eyebrow: 'KPI Detail',
                      body: `Upheld rate is ${formatPercent(risk.upheldRate)} (corpus average: ${formatPercent(risk.overallUpheldRate)}). Trend direction is ${risk.trendDirection}.`,
                    })
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0f1f4f]/30 hover:shadow-md"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <TrendingUp className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                    Upheld rate
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[#08162f]">{formatPercent(risk.upheldRate)}</p>
                  <span className={cn('mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold', upheldDelta > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>
                    {upheldDelta >= 0 ? '+' : ''}{upheldDelta.toFixed(1)} pp vs avg
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      title: 'Not Upheld Rate',
                      eyebrow: 'KPI Detail',
                      body: `${formatPercent(risk.notUpheldRate)} of published decisions in this slice were not upheld.`,
                    })
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0f1f4f]/30 hover:shadow-md"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    Not upheld rate
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[#08162f]">{formatPercent(risk.notUpheldRate)}</p>
                  <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Firm position upheld
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      title: 'Evidence Depth Score',
                      eyebrow: 'Statistical Confidence',
                      body: `Confidence score (${confidenceScore.pct}% · ${confidenceScore.label}) reflects the published sample size (${formatNumber(risk.sampleSize)} decisions) available for this slice.`,
                    })
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0f1f4f]/30 hover:shadow-md"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Scale className="h-3.5 w-3.5 text-violet-700" aria-hidden="true" />
                    Evidence depth
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[#08162f]">{confidenceScore.pct}%</p>
                  <span className="mt-2 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                    {confidenceScore.label} sample
                  </span>
                </button>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:col-span-2 lg:col-span-1">
                  <p className="mb-1 text-xs font-semibold text-[#08162f]">Outcome distribution</p>
                  {brief.outcomeDistribution && brief.outcomeDistribution.length > 0 ? (
                    <OutcomeDonutChart distribution={brief.outcomeDistribution} compact />
                  ) : (
                    <p className="pt-6 text-xs text-slate-400">Distribution unavailable</p>
                  )}
                </div>
              </section>

              {/* 3. Two Charts Side-by-Side: Trend + Prevalent Issues */}
              <section className="grid gap-3 lg:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-[#08162f]">Cases &amp; Upheld Trend</h2>
                      <p className="text-[11px] text-slate-500">Annual published volume and upheld rate trajectory</p>
                    </div>
                    <BarChart3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </div>
                  {risk.yearTrend.length > 1 ? (
                    <YearTrendChart yearTrend={risk.yearTrend} />
                  ) : (
                    <p className="py-12 text-center text-xs text-slate-500">Multi-year trend requires at least 2 active years.</p>
                  )}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-[#08162f]">Prevalent Issues &amp; Root Causes</h2>
                      <p className="text-[11px] text-slate-500">Click any issue bar to inspect its uphold profile</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      Top {Math.min(6, brief.rootCausePatterns.length)}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {brief.rootCausePatterns.slice(0, 6).map((pattern) => {
                      const widthPct = Math.max(8, Math.round((pattern.count / maxRootCauseCount) * 100));
                      return (
                        <button
                          key={pattern.label}
                          type="button"
                          onClick={() =>
                            setModal({
                              title: pattern.label,
                              eyebrow: 'Root Cause Driver',
                              body: `Appears in ${formatNumber(pattern.count)} published decisions for ${brief.query.product}, with an upheld rate of ${formatPercent(pattern.upheldRate)}.`,
                            })
                          }
                          className="group block w-full text-left"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-slate-700 group-hover:text-[#0f1f4f]">{pattern.label}</span>
                            <span className="shrink-0 tabular-nums text-[11px] font-semibold text-slate-600">
                              {formatPercent(pattern.upheldRate)} upheld · {formatNumber(pattern.count)}
                            </span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#0f1f4f] to-violet-600 transition-all group-hover:opacity-90"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </article>
              </section>

              {/* 4. 3-Column Action & Insight Row */}
              <section className="grid gap-3 lg:grid-cols-3">
                <article className="rounded-2xl border border-violet-200/80 bg-[linear-gradient(180deg,#fbfaff_0%,#ffffff_100%)] p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#08162f]">
                      <Sparkles className="h-4 w-4 text-violet-700" aria-hidden="true" />
                      Recommendation
                    </h2>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                      {risk.upholdRiskLevel.replace('_', ' ')} priority
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">
                    {brief.aiExecutiveSummary || `Focus review controls on ${topDriver?.label || 'core complaint drivers'} and align pre-referral evidence with published FOS reasoning.`}
                  </p>
                  {brief.aiExecutiveSummary && (
                    <button
                      type="button"
                      onClick={() =>
                        setModal({
                          title: 'Executive Narrative & Guidance',
                          eyebrow: 'Advisor Brief',
                          body: [brief.aiExecutiveSummary, brief.aiGuidance].filter(Boolean).join('\n\n'),
                        })
                      }
                      className="mt-2.5 text-xs font-semibold text-violet-700 hover:text-violet-900"
                    >
                      Read full narrative →
                    </button>
                  )}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-[#08162f]">Key Factors &amp; Precedents</h2>
                  <ul className="mt-2.5 space-y-2">
                    {brief.keyPrecedents.slice(0, 3).map((prec) => (
                      <li key={prec.label} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs">
                        <span className="truncate font-medium text-slate-700">{prec.label}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-[#0f1f4f]">{formatPercent(prec.percentOfCases)}</span>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-[#08162f]">Potential Next Actions</h2>
                  <div className="mt-2.5 grid gap-1.5">
                    {brief.recommendedActions.slice(0, 4).map((act, idx) => {
                      const done = Boolean(checkedActions[idx]);
                      return (
                        <button
                          key={act.item}
                          type="button"
                          onClick={() => setCheckedActions((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                          className={cn(
                            'flex items-start gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition',
                            done ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 line-through' : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-violet-200 hover:bg-white'
                          )}
                        >
                          <CheckCircle2 className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', done ? 'text-emerald-600' : 'text-violet-500')} aria-hidden="true" />
                          <span className="line-clamp-2">{act.item}</span>
                        </button>
                      );
                    })}
                  </div>
                </article>
              </section>

              {/* 5. Compact Tabbed Bottom Panel (No Vertical Bloat) */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 pt-3">
                  <div className="flex flex-wrap gap-1" role="tablist" aria-label="Advisor detail views">
                    {(
                      [
                        { key: 'decisions', label: `Sample Decisions (${brief.sampleCases.length})` },
                        { key: 'signals', label: 'Precedents & Win/Lose Signals' },
                        { key: 'narrative', label: 'Compliance Narrative' },
                        { key: 'actions', label: `Full Checklist (${brief.recommendedActions.length})` },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={bottomTab === t.key}
                        onClick={() => setBottomTab(t.key)}
                        className={cn(
                          'border-b-2 px-3 py-2 text-xs font-semibold transition',
                          bottomTab === t.key
                            ? 'border-[#0f1f4f] text-[#0f1f4f]'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4">
                  {bottomTab === 'decisions' && (
                    <DecisionsBrowser cases={brief.sampleCases} onSelectCase={setSelectedCaseId} />
                  )}

                  {bottomTab === 'signals' && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-4">
                        <PrecedentBarChart precedents={brief.keyPrecedents} />
                        <PrecedentList precedents={brief.keyPrecedents} />
                      </div>
                      <div className="grid gap-4">
                        <ThemeCard
                          title="Why firms succeeded (not upheld)"
                          aiNarrative={brief.aiWhatWins}
                          themes={brief.whatWins}
                          variant="wins"
                        />
                        <ThemeCard
                          title="Why complainants succeeded (upheld)"
                          aiNarrative={brief.aiWhatLoses}
                          themes={brief.whatLoses}
                          variant="loses"
                        />
                      </div>
                    </div>
                  )}

                  {bottomTab === 'narrative' && (
                    <div className="space-y-3 text-sm leading-6 text-slate-700">
                      {brief.aiExecutiveSummary && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Executive Summary</h3>
                          <p className="mt-1 whitespace-pre-line">{brief.aiExecutiveSummary}</p>
                        </div>
                      )}
                      {brief.aiGuidance && (
                        <div className="rounded-xl border-l-4 border-[#0f1f4f] bg-slate-50 p-4">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f1f4f]">Compliance Guidance (Human review required)</h3>
                          <p className="mt-1.5 whitespace-pre-line text-xs leading-6 text-slate-700">{brief.aiGuidance}</p>
                        </div>
                      )}
                      {!brief.aiExecutiveSummary && !brief.aiGuidance && (
                        <p className="text-xs text-slate-500">No AI narrative is attached to this slice yet. Use the Sample Decisions and Precedents tabs for source-backed evidence.</p>
                      )}
                    </div>
                  )}

                  {bottomTab === 'actions' && (
                    <ActionChecklist actions={brief.recommendedActions} />
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Case detail sheet */}
        <CaseDetailSheet
          open={!!selectedCaseId}
          onOpenChange={(open) => !open && setSelectedCaseId(null)}
          caseDetail={selectedCase}
          loading={caseLoading}
          error={caseError}
          onSelectCase={setSelectedCaseId}
        />

        {/* Native Insight Detail Modal */}
        <dialog
          ref={modalRef}
          {...({ closedby: 'any' } as Record<string, string>)}
          className="rc-native-dialog w-[min(560px,calc(100%-24px))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl"
        >
          {modal && (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#08162f] px-6 py-4 text-white">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e2b12f]">{modal.eyebrow}</p>
                  <h1 className="mt-1 text-lg font-semibold">{modal.title}</h1>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Close insight modal"
                  className="rounded-lg p-1.5 text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="p-6">
                <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{modal.body}</p>
              </div>
            </>
          )}
        </dialog>
      </main>
    </div>
  );
}
