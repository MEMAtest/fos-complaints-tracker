'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFosFilters, buildQueryParams } from '@/hooks/use-fos-filters';
import { useLoadingProgress } from '@/hooks/use-loading-progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { FirmSelector } from '@/components/comparison/firm-selector';
import { OutcomeComparison } from '@/components/comparison/outcome-comparison';
import { ThemeRadar } from '@/components/comparison/theme-radar';
import { ComparisonTable } from '@/components/comparison/comparison-table';
import { FOSComparisonSnapshot, FOSFirmBenchmarkPoint } from '@/lib/fos/types';

const COMPARISON_TIMEOUT_MS = 60_000;

export default function ComparisonPage() {
  const { filters, initialized } = useFosFilters();

  // Firm list state - fetched from analysis API
  const [firms, setFirms] = useState<string[]>([]);
  const [firmsLoading, setFirmsLoading] = useState(true);

  // Selection state
  const [firmA, setFirmA] = useState('');
  const [firmB, setFirmB] = useState('');

  // Comparison data state
  const [snapshot, setSnapshot] = useState<FOSComparisonSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ cached: boolean; queryMs: number } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const progress = useLoadingProgress(loading);

  // Fetch list of firms from the analysis API
  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();

    async function fetchFirms() {
      setFirmsLoading(true);
      try {
        const params = buildQueryParams(filters);
        const response = await fetch(`/api/fos/analysis?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Failed to fetch firms list.');
        const payload = await response.json();
        if (payload.success && payload.data?.firmBenchmark) {
          const firmNames = (payload.data.firmBenchmark as FOSFirmBenchmarkPoint[])
            .map((f) => f.firm)
            .sort((a, b) => a.localeCompare(b));
          if (!controller.signal.aborted) setFirms(firmNames);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Silently fail - firms list will be empty
      } finally {
        if (!controller.signal.aborted) setFirmsLoading(false);
      }
    }

    void fetchFirms();
    return () => { controller.abort(); };
  }, [filters, initialized]);

  // Fetch comparison data when both firms are selected
  const fetchComparison = useCallback(async (selectedFirmA: string, selectedFirmB: string) => {
    if (!selectedFirmA || !selectedFirmB) return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort(); }, COMPARISON_TIMEOUT_MS);
    const startedAt = Date.now();

    setLoading(true);
    setError(null);
    progress.startTracking();

    try {
      const params = buildQueryParams(filters);
      params.set('firmA', selectedFirmA);
      params.set('firmB', selectedFirmB);

      const response = await fetch(`/api/fos/comparison?${params.toString()}`, {
        signal: controller.signal,
      });

      let payload: { success: boolean; data?: FOSComparisonSnapshot; meta?: { cached: boolean; queryMs: number }; error?: string } | null = null;
      try { payload = await response.json(); } catch { payload = null; }

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || `Comparison request failed (${response.status}).`);
      }

      progress.recordDuration(Date.now() - startedAt);
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
        progress.stopTracking();
      }
    }
  }, [filters, progress]);

  // Trigger comparison fetch when both firms are selected
  useEffect(() => {
    if (!initialized || !firmA || !firmB) {
      setSnapshot(null);
      return;
    }
    void fetchComparison(firmA, firmB);
  }, [firmA, firmB, initialized, fetchComparison]);

  // Cleanup on unmount
  useEffect(() => () => { requestRef.current?.abort(); }, []);

  const bothSelected = firmA !== '' && firmB !== '';
  const metaLine = meta
    ? `${meta.cached ? 'cache hit' : 'fresh query'} \u00b7 ${meta.queryMs}ms`
    : null;

  return (
    <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-5 px-4 py-5 md:px-8">
      {/* Loading bar */}
      {loading && (
        <div className="sticky top-0 z-40 -mx-4 -mt-5 mb-0 h-1 w-[calc(100%+2rem)] overflow-hidden bg-blue-100/80 md:-mx-8 md:w-[calc(100%+4rem)]">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-teal-600 to-blue-600" />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Firm Comparison
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Compare two firms side-by-side across outcomes, product distributions, and key metrics.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          {loading
            ? `Loading comparison \u00b7 ${progress.loadingElapsedSec}s elapsed`
            : metaLine || (firmsLoading ? 'Loading firms list...' : `${firms.length} firms available`)}
        </p>
      </div>

      {/* Firm selectors */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FirmSelector
              label="Firm A"
              value={firmA}
              firms={firms.filter((f) => f !== firmB)}
              onSelect={setFirmA}
            />
            <FirmSelector
              label="Firm B"
              value={firmB}
              firms={firms.filter((f) => f !== firmA)}
              onSelect={setFirmB}
            />
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>{error}</span>
          <button
            onClick={() => void fetchComparison(firmA, firmB)}
            className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-400"
          >
            Retry now
          </button>
        </section>
      )}

      {/* Prompt when not both selected */}
      {!bothSelected && !loading && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            Select two firms above to compare their FOS complaint outcomes, product distributions, and key metrics.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !snapshot && bothSelected && (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Comparison results */}
      {snapshot && bothSelected && (
        <>
          {/* Outcome comparison bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Outcome Comparison</CardTitle>
              <p className="text-sm text-slate-500">
                Upheld and not-upheld rates side-by-side.
              </p>
            </CardHeader>
            <CardContent>
              <OutcomeComparison firmA={snapshot.firmA} firmB={snapshot.firmB} />
            </CardContent>
          </Card>

          {/* Radar chart + comparison table */}
          <section className="grid gap-4 xl:grid-cols-2 xl:items-start">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Product Upheld-Rate Radar</CardTitle>
                <p className="text-sm text-slate-500">
                  Overlapping product category upheld rates.
                </p>
              </CardHeader>
              <CardContent>
                <ThemeRadar firmA={snapshot.firmA} firmB={snapshot.firmB} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Key Metrics</CardTitle>
                <p className="text-sm text-slate-500">
                  Side-by-side metric comparison. Better values highlighted in green.
                </p>
              </CardHeader>
              <CardContent>
                <ComparisonTable firmA={snapshot.firmA} firmB={snapshot.firmB} />
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
