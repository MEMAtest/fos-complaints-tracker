'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Maximize2,
  Scale,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useFosFilters, buildQueryParams } from '@/hooks/use-fos-filters';
import { useLoadingProgress } from '@/hooks/use-loading-progress';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { YearFilterBar } from '@/components/shared/year-filter-bar';
import { MultiFirmSelector, type FirmSearchResult } from '@/components/comparison/multi-firm-selector';
import { OutcomeComparison } from '@/components/comparison/outcome-comparison';
import { ThemeRadar } from '@/components/comparison/theme-radar';
import { FirmTrendChart } from '@/components/comparison/firm-trend-chart';
import { ComparisonTable } from '@/components/comparison/comparison-table';
import { FOSComparisonSnapshot } from '@/lib/fos/types';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { cn, formatNumber, formatPercent } from '@/lib/utils';

const COMPARISON_TIMEOUT_MS = 60_000;

type DetailModalState =
  | null
  | { type: 'chart'; chart: 'outcome' | 'radar' | 'trend'; title: string; subtitle: string }
  | { type: 'metric'; label: string; insight: string; values: Array<{ firm: string; value: string }> };

function useComparisonDialog(open: boolean, onClose: () => void) {
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

export default function ComparisonPage() {
  const { filters, initialized, toggleYear, setYears } = useFosFilters();
  const [firmQuery, setFirmQuery] = useState('');
  const [firmResults, setFirmResults] = useState<FirmSearchResult[]>([]);
  const [firmsLoading, setFirmsLoading] = useState(true);
  const [selectedFirms, setSelectedFirms] = useState<string[]>([]);
  const [didAutoSeed, setDidAutoSeed] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [snapshot, setSnapshot] = useState<FOSComparisonSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ cached: boolean; queryMs: number } | null>(null);
  const [showYearFilters, setShowYearFilters] = useState(false);
  const [detailModal, setDetailModal] = useState<DetailModalState>(null);

  const requestRef = useRef<AbortController | null>(null);
  const progress = useLoadingProgress(loading);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const closeDetailModal = useCallback(() => setDetailModal(null), []);
  const detailDialogRef = useComparisonDialog(detailModal !== null, closeDetailModal);

  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();

    async function fetchYears() {
      try {
        const params = buildQueryParams(filters);
        params.delete('firm');
        const response = await fetch(`/api/fos/analysis?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        if (payload.success && payload.data?.yearProductOutcome) {
          const yearSet = new Set<number>();
          for (const row of payload.data.yearProductOutcome as { year: number }[]) {
            yearSet.add(row.year);
          }
          if (!controller.signal.aborted) {
            setAvailableYears(Array.from(yearSet).sort((a, b) => a - b));
          }
        }
      } catch {
        // best-effort metadata load
      }
    }

    void fetchYears();
    return () => controller.abort();
  }, [filters, initialized]);

  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setFirmsLoading(true);
      try {
        const params = buildQueryParams(filters);
        params.delete('firm');
        if (firmQuery.trim()) params.set('q', firmQuery.trim());
        params.set('limit', '30');
        const response = await fetch(`/api/fos/firms?${params.toString()}`, { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Failed to search firms.');
        if (!controller.signal.aborted) {
          const rows: FirmSearchResult[] = payload.results || [];
          setFirmResults(rows);
          if (!didAutoSeed && !firmQuery.trim() && selectedFirms.length === 0 && rows.length >= 2) {
            setDidAutoSeed(true);
            setSelectedFirms([rows[0].firm, rows[1].firm]);
          }
        }
      } catch {
        if (!controller.signal.aborted) setFirmResults([]);
      } finally {
        if (!controller.signal.aborted) setFirmsLoading(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [filters, firmQuery, initialized, didAutoSeed, selectedFirms.length]);

  const fetchComparison = useCallback(async (firmNames: string[]) => {
    if (firmNames.length < 2) return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort(); }, COMPARISON_TIMEOUT_MS);
    const startedAt = Date.now();

    setLoading(true);
    setError(null);
    progressRef.current.startTracking();

    try {
      const params = buildQueryParams(filters);
      params.delete('firm');
      for (const name of firmNames) params.append('firm', name);

      const response = await fetch(`/api/fos/comparison?${params.toString()}`, {
        signal: controller.signal,
      });

      let payload: { success: boolean; data?: FOSComparisonSnapshot; meta?: { cached: boolean; queryMs: number }; error?: string } | null = null;
      try { payload = await response.json(); } catch { payload = null; }

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || `Comparison request failed (${response.status}).`);
      }

      progressRef.current.recordDuration(Date.now() - startedAt);
      setSnapshot(payload.data);
      setMeta(payload.meta || null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (timedOut) setError(`Comparison query timed out after ${Math.round(COMPARISON_TIMEOUT_MS / 1000)}s. Try different firms.`);
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown comparison error.');
    } finally {
      window.clearTimeout(timeoutId);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
        progressRef.current.stopTracking();
      }
    }
  }, [filters]);

  useEffect(() => {
    if (!initialized || selectedFirms.length < 2) {
      setSnapshot(null);
      return;
    }
    void fetchComparison(selectedFirms);
  }, [selectedFirms, initialized, fetchComparison]);

  useEffect(() => () => { requestRef.current?.abort(); }, []);

  const hasEnoughFirms = selectedFirms.length >= 2;
  const f0 = snapshot?.firms[0];
  const f1 = snapshot?.firms[1];

  const upheldDelta = f0 && f1 ? f1.upheldRate - f0.upheldRate : null;
  const notUpheldDelta = f0 && f1 ? f1.notUpheldRate - f0.notUpheldRate : null;
  const casesDelta = f0 && f1 ? f1.totalCases - f0.totalCases : null;

  const swapPrimaryFirms = () => {
    if (selectedFirms.length < 2) return;
    setSelectedFirms([selectedFirms[1], selectedFirms[0], ...selectedFirms.slice(2)]);
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-950">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-[1380px] flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
        {loading && (
          <div className="sticky top-0 z-40 -mx-4 -mt-4 h-1 w-[calc(100%+2rem)] overflow-hidden bg-blue-100/80 md:-mx-6 md:w-[calc(100%+3rem)]">
            <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-[#0f1f4f] to-[#e2b12f]" />
          </div>
        )}

        {/* Compact Executive Header & Selector Strip */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0f1f4f]/70">Firm Intelligence</p>
              <h1 className="text-2xl font-semibold tracking-tight text-[#08162f]">
                {hasEnoughFirms && selectedFirms.length === 2
                  ? `${selectedFirms[0]} vs ${selectedFirms[1]}`
                  : 'Firm Comparison'}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedFirms.length >= 2 && (
                <button
                  type="button"
                  onClick={swapPrimaryFirms}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#0f1f4f]/30 hover:bg-white"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                  Swap order
                </button>
              )}
              {availableYears.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowYearFilters((prev) => !prev)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    filters.years.length > 0 || showYearFilters
                      ? 'border-[#0f1f4f] bg-[#0f1f4f] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  )}
                >
                  {filters.years.length > 0 ? `Years (${filters.years.length})` : 'Filter years'}
                </button>
              )}
              {meta && (
                <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 sm:inline">
                  {meta.cached ? 'Cached' : 'Live'} · {meta.queryMs}ms
                </span>
              )}
            </div>
          </div>

          <div className="mt-3">
            <MultiFirmSelector
              results={firmResults}
              searchQuery={firmQuery}
              onSearchQueryChange={setFirmQuery}
              selectedFirms={selectedFirms}
              onSelectedFirmsChange={setSelectedFirms}
              loading={firmsLoading}
            />
          </div>

          {showYearFilters && availableYears.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <YearFilterBar
                availableYears={availableYears}
                activeYears={filters.years}
                onToggleYear={toggleYear}
                onSelectAll={setYears}
                onClearYears={() => setYears([])}
                accentColor="blue"
              />
            </div>
          )}
        </section>

        {error && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void fetchComparison(selectedFirms)}
              className="rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:border-rose-400"
            >
              Retry now
            </button>
          </section>
        )}

        {!hasEnoughFirms && !loading && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-sm text-slate-600">
              Select at least two firms above to compare upheld rates, product radar exposure, and multi-year trends.
            </p>
          </div>
        )}

        {loading && !snapshot && hasEnoughFirms && (
          <div className="grid gap-4 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {snapshot && hasEnoughFirms && (
          <>
            {/* Row 1: 3 Clickable KPI Delta Cards */}
            <section className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  setDetailModal({
                    type: 'metric',
                    label: 'Upheld Rate Breakdown',
                    insight: 'Percentage of published FOS decisions upheld in favour of the complainant. Lower generally indicates stronger internal complaint resolution.',
                    values: snapshot.firms.map((f) => ({ firm: f.name, value: formatPercent(f.upheldRate) })),
                  })
                }
                className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0f1f4f]/30 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <BarChart3 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-[#08162f]">Upheld Rate</p>
                      <p className="text-[11px] text-slate-500">Click for firm detail</p>
                    </div>
                  </div>
                  {upheldDelta !== null && (
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums', upheldDelta <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>
                      {upheldDelta > 0 ? '+' : ''}{upheldDelta.toFixed(1)} pp
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-blue-700">{f0 ? formatPercent(f0.upheldRate) : '—'}</span>
                  <span className="text-xs font-medium text-slate-400">vs</span>
                  <span className="text-2xl font-bold tabular-nums text-violet-700">{f1 ? formatPercent(f1.upheldRate) : '—'}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDetailModal({
                    type: 'metric',
                    label: 'Not Upheld Rate Breakdown',
                    insight: 'Percentage of published FOS decisions resolved as not upheld.',
                    values: snapshot.firms.map((f) => ({ firm: f.name, value: formatPercent(f.notUpheldRate) })),
                  })
                }
                className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0f1f4f]/30 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                      <Scale className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-[#08162f]">Not Upheld Rate</p>
                      <p className="text-[11px] text-slate-500">Click for firm detail</p>
                    </div>
                  </div>
                  {notUpheldDelta !== null && (
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums', notUpheldDelta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>
                      {notUpheldDelta > 0 ? '+' : ''}{notUpheldDelta.toFixed(1)} pp
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-blue-700">{f0 ? formatPercent(f0.notUpheldRate) : '—'}</span>
                  <span className="text-xs font-medium text-slate-400">vs</span>
                  <span className="text-2xl font-bold tabular-nums text-violet-700">{f1 ? formatPercent(f1.notUpheldRate) : '—'}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDetailModal({
                    type: 'metric',
                    label: 'Published Case Volume',
                    insight: 'Total published Financial Ombudsman decisions in the selected period for each firm.',
                    values: snapshot.firms.map((f) => ({ firm: f.name, value: `${formatNumber(f.totalCases)} cases` })),
                  })
                }
                className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0f1f4f]/30 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#0f1f4f]">
                      <Users className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-[#08162f]">Total Cases</p>
                      <p className="text-[11px] text-slate-500">Published FOS decisions</p>
                    </div>
                  </div>
                  {casesDelta !== null && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                      {casesDelta > 0 ? '+' : ''}{formatNumber(casesDelta)}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-blue-700">{f0 ? formatNumber(f0.totalCases) : '—'}</span>
                  <span className="text-xs font-medium text-slate-400">vs</span>
                  <span className="text-2xl font-bold tabular-nums text-violet-700">{f1 ? formatNumber(f1.totalCases) : '—'}</span>
                </div>
              </button>
            </section>

            {/* Row 2: 3 Charts Side-by-Side in ONE Row (No Excessive Scrolling) */}
            <section className="grid gap-3 lg:grid-cols-3">
              <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[#08162f]">Upheld vs Not Upheld Rate</h2>
                    <p className="text-[11px] text-slate-500">Side-by-side outcome comparison</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDetailModal({
                        type: 'chart',
                        chart: 'outcome',
                        title: 'Upheld vs Not Upheld Rate',
                        subtitle: 'Expanded comparison across all selected firms.',
                      })
                    }
                    aria-label="Expand outcome chart"
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-[#0f1f4f]/30 hover:text-[#0f1f4f]"
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <OutcomeComparison firms={snapshot.firms} height={220} />
              </article>

              <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[#08162f]">Product Upheld-Rate Radar</h2>
                    <p className="text-[11px] text-slate-500">Overlaid product category exposure</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDetailModal({
                        type: 'chart',
                        chart: 'radar',
                        title: 'Product Upheld-Rate Radar',
                        subtitle: 'Product category upheld rates overlaid across selected firms.',
                      })
                    }
                    aria-label="Expand product radar chart"
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-[#0f1f4f]/30 hover:text-[#0f1f4f]"
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <ThemeRadar firms={snapshot.firms} height={220} />
              </article>

              <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[#08162f]">Upheld Rate Trend</h2>
                    <p className="text-[11px] text-slate-500">Multi-year trajectory by firm</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDetailModal({
                        type: 'chart',
                        chart: 'trend',
                        title: 'Upheld Rate Trend',
                        subtitle: 'Year-by-year upheld rate progression across selected firms.',
                      })
                    }
                    aria-label="Expand trend chart"
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-[#0f1f4f]/30 hover:text-[#0f1f4f]"
                  >
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <FirmTrendChart firms={snapshot.firms} height={220} />
              </article>
            </section>

            {/* Row 3: Compact Key Metrics Comparison */}
            <ComparisonTable
              firms={snapshot.firms}
              onSelectMetric={(metric) =>
                setDetailModal({
                  type: 'metric',
                  label: metric.label,
                  insight: metric.insight,
                  values: metric.values,
                })
              }
            />
          </>
        )}
      </main>

      {/* Interactive Native Drill-Down Modal */}
      <dialog
        ref={detailDialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        className="rc-native-dialog w-[min(760px,calc(100%-24px))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl"
      >
        {detailModal && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#08162f] px-6 py-4 text-white">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e2b12f]">Firm Comparison Detail</p>
                <h1 className="mt-1 text-lg font-semibold">
                  {detailModal.type === 'chart' ? detailModal.title : detailModal.label}
                </h1>
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                aria-label="Close detail modal"
                className="rounded-lg p-1.5 text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-6">
              {detailModal.type === 'chart' && snapshot ? (
                <div>
                  <p className="mb-4 text-xs text-slate-600">{detailModal.subtitle}</p>
                  {detailModal.chart === 'outcome' && <OutcomeComparison firms={snapshot.firms} height={360} />}
                  {detailModal.chart === 'radar' && <ThemeRadar firms={snapshot.firms} height={380} />}
                  {detailModal.chart === 'trend' && <FirmTrendChart firms={snapshot.firms} height={360} />}
                </div>
              ) : detailModal.type === 'metric' ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-slate-600">{detailModal.insight}</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {detailModal.values.map((item) => (
                      <div key={item.firm} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                        <p className="text-xs font-medium text-slate-500">{item.firm}</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-[#08162f]">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
