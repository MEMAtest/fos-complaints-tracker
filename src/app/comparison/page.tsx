'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFosFilters, buildQueryParams } from '@/hooks/use-fos-filters';
import { useLoadingProgress } from '@/hooks/use-loading-progress';
import { Card, CardContent } from '@/components/ui/card';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { YearFilterBar } from '@/components/shared/year-filter-bar';
import { MultiFirmSelector, type FirmSearchResult } from '@/components/comparison/multi-firm-selector';
import { OutcomeComparison } from '@/components/comparison/outcome-comparison';
import { ThemeRadar } from '@/components/comparison/theme-radar';
import { ComparisonTable } from '@/components/comparison/comparison-table';
import { FOSComparisonSnapshot } from '@/lib/fos/types';

const COMPARISON_TIMEOUT_MS = 60_000;

export default function ComparisonPage() {
  const { filters, initialized, toggleYear, setYears } = useFosFilters();
  const [firmQuery, setFirmQuery] = useState('');
  const [firmResults, setFirmResults] = useState<FirmSearchResult[]>([]);
  const [firmsLoading, setFirmsLoading] = useState(true);
  const [selectedFirms, setSelectedFirms] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [snapshot, setSnapshot] = useState<FOSComparisonSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ cached: boolean; queryMs: number } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const progress = useLoadingProgress(loading);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();

    async function fetchYears() {
      try {
        const params = buildQueryParams(filters);
        params.delete('firm');
        const response = await fetch(`/api/fos/analysis?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to fetch analysis metadata.');
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
          setFirmResults(payload.results || []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setFirmResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setFirmsLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [filters, firmQuery, initialized]);

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
      for (const name of firmNames) {
        params.append('firm', name);
      }

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
  const metaLine = meta ? `${meta.cached ? 'cache hit' : 'fresh query'} · ${meta.queryMs}ms` : null;
  const helperLine = useMemo(() => {
    if (loading) return `Loading comparison · ${progress.loadingElapsedSec}s elapsed`;
    if (metaLine) return metaLine;
    if (firmsLoading) return 'Refreshing firm index…';
    return firmQuery.trim() ? `${firmResults.length} suggestion(s) for “${firmQuery.trim()}”` : 'Search all firms';
  }, [loading, progress.loadingElapsedSec, metaLine, firmsLoading, firmQuery, firmResults.length]);

  const title = useMemo(() => {
    if (!hasEnoughFirms) return 'Firm Comparison';
    if (selectedFirms.length === 2) return `Comparing ${selectedFirms[0]} vs. ${selectedFirms[1]}`;
    return `Comparing ${selectedFirms.length} firms`;
  }, [hasEnoughFirms, selectedFirms]);

  return (
    <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-5 px-4 py-5 md:px-8">
      {loading && (
        <div className="sticky top-0 z-40 -mx-4 -mt-5 mb-0 h-1 w-[calc(100%+2rem)] overflow-hidden bg-blue-100/80 md:-mx-8 md:w-[calc(100%+4rem)]">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-teal-600 to-blue-600" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Compare up to 5 firms across outcomes, product distributions, and key metrics.</p>
        </div>
        <p className="text-xs text-slate-500">{helperLine}</p>
      </div>

      {availableYears.length > 0 && (
        <YearFilterBar
          availableYears={availableYears}
          activeYears={filters.years}
          onToggleYear={toggleYear}
          onSelectAll={setYears}
          onClearYears={() => setYears([])}
          accentColor="blue"
        />
      )}

      <Card>
        <CardContent className="pt-6">
          <MultiFirmSelector
            results={firmResults}
            searchQuery={firmQuery}
            onSearchQueryChange={setFirmQuery}
            selectedFirms={selectedFirms}
            onSelectedFirmsChange={setSelectedFirms}
            loading={firmsLoading}
          />
        </CardContent>
      </Card>

      {error && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>{error}</span>
          <button
            onClick={() => void fetchComparison(selectedFirms)}
            className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-400"
          >
            Retry now
          </button>
        </section>
      )}

      {!hasEnoughFirms && !loading && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            Select at least two firms above to compare their FOS complaint outcomes, product distributions, and key metrics.
          </p>
        </div>
      )}

      {loading && !snapshot && hasEnoughFirms && (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {snapshot && hasEnoughFirms && (
        <>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Outcome Comparison</h2>
            <p className="mb-4 text-sm text-slate-500">Upheld and not-upheld rates across selected firms.</p>
            <OutcomeComparison firms={snapshot.firms} split />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Product Upheld-Rate Radar</h2>
            <p className="mb-4 text-sm text-slate-500">Product category upheld rates per firm.</p>
            <ThemeRadar firms={snapshot.firms} split />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Key Metrics</h2>
            <p className="mb-4 text-sm text-slate-500">Side-by-side metric comparison with explainers.</p>
            <ComparisonTable firms={snapshot.firms} />
          </section>
        </>
      )}
    </div>
  );
}
