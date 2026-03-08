'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExpandableCard } from '@/components/shared/expandable-card';
import { useFosFilters, buildQueryParams } from '@/hooks/use-fos-filters';
import { useLoadingProgress } from '@/hooks/use-loading-progress';
import { SearchBar } from '@/components/dashboard/search-bar';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { FilterPill } from '@/components/shared/filter-pills';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { SunburstChart } from '@/components/root-causes/sunburst-chart';
import { TopCausesTable } from '@/components/root-causes/top-causes-table';
import { CauseTreemap } from '@/components/root-causes/cause-treemap';
import { YearFilterBar } from '@/components/shared/year-filter-bar';
import { formatNumber, formatDateTime } from '@/lib/utils';
import type { FOSRootCauseSnapshot, FOSDashboardFilters } from '@/lib/fos/types';

interface RootCauseApiMeta {
  queryMs: number;
  cached: boolean;
  snapshotAt?: string;
}

interface RootCauseApiResponse {
  success: boolean;
  data?: FOSRootCauseSnapshot;
  generatedAt?: string;
  meta?: RootCauseApiMeta;
  error?: string;
}

const ROOT_CAUSE_TIMEOUT_MS = 60_000;

export default function RootCausesPage() {
  const {
    filters,
    queryDraft,
    setQueryDraft,
    initialized,
    hasActiveFilters,
    toggleYear,
    toggleProduct,
    toggleFirm,
    toggleTag,
    setYears,
    applySearchQuery,
    clearFilters,
    setFilters,
  } = useFosFilters();

  const [snapshot, setSnapshot] = useState<FOSRootCauseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<RootCauseApiMeta | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const progress = useLoadingProgress(loading);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const fetchRootCauses = useCallback(async (nextFilters: FOSDashboardFilters) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort(); }, ROOT_CAUSE_TIMEOUT_MS);
    const startedAt = Date.now();

    setLoading(true);
    setError(null);
    progressRef.current.startTracking();

    try {
      const response = await fetch(
        `/api/fos/root-causes?${buildQueryParams(nextFilters).toString()}`,
        { signal: controller.signal }
      );
      let payload: RootCauseApiResponse | null = null;
      try { payload = (await response.json()) as RootCauseApiResponse; } catch { payload = null; }

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || `Root cause request failed (${response.status}).`);
      }

      progressRef.current.recordDuration(Date.now() - startedAt);
      setSnapshot(payload.data);
      setMeta(payload.meta || null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (timedOut) setError(`Root cause query timed out after ${Math.round(ROOT_CAUSE_TIMEOUT_MS / 1000)}s. Retry with fewer filters.`);
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown root cause analysis error.');
    } finally {
      window.clearTimeout(timeoutId);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
        progressRef.current.stopTracking();
      }
    }
  }, []);

  useEffect(() => {
    if (!initialized) return;
    void fetchRootCauses(filters);
  }, [fetchRootCauses, filters, initialized]);

  useEffect(() => () => { requestRef.current?.abort(); }, []);

  /* ---- derived metrics ---- */
  const totalCauseTags = useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.rootCauses.reduce((sum, rc) => sum + rc.count, 0);
  }, [snapshot]);

  const uniqueCauses = useMemo(() => snapshot?.rootCauses.length || 0, [snapshot]);

  const topCause = useMemo(() => {
    if (!snapshot || !snapshot.rootCauses.length) return 'n/a';
    return snapshot.rootCauses[0].label;
  }, [snapshot]);

  const categoryCount = useMemo(() => snapshot?.hierarchy.length || 0, [snapshot]);

  const availableYears = useMemo(() => {
    if (!snapshot) return [];
    const yearSet = new Set<number>();
    for (const rc of snapshot.rootCauses) {
      for (const t of rc.trend) {
        yearSet.add(t.year);
      }
    }
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [snapshot]);

  const loadingStatusText = useMemo(() => {
    if (!loading) return null;
    const phase =
      progress.loadingElapsedSec < 2
        ? 'Querying root cause tags'
        : progress.loadingElapsedSec < 6
          ? 'Building hierarchy and trends'
          : 'Rendering visualizations';
    if (progress.estimatedRemainingSec != null) {
      return `${phase} · ${progress.loadingElapsedSec}s elapsed · ~${progress.estimatedRemainingSec}s remaining`;
    }
    return `${phase} · ${progress.loadingElapsedSec}s elapsed`;
  }, [loading, progress.loadingElapsedSec, progress.estimatedRemainingSec]);

  const metaLine = meta
    ? `${meta.cached ? 'cache hit' : 'fresh query'} · ${meta.queryMs}ms`
    : null;

  return (
    <main className="relative min-h-screen pb-16">
      {loading && (
        <div className="sticky top-0 z-40 h-1 w-full overflow-hidden bg-purple-100/80">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-purple-600 to-teal-500" />
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-5 px-4 py-5 md:px-8">
        {/* ---- header ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Root Cause Analysis</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Explore root-cause tag patterns, hierarchies, and frequency across the FOS decisions corpus.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            {loadingStatusText || (meta?.snapshotAt ? `Updated ${formatDateTime(meta.snapshotAt)}` : metaLine || 'Awaiting root cause data')}
          </p>
        </div>

        {/* ---- search + filters ---- */}
        <SearchBar
          queryDraft={queryDraft}
          onQueryDraftChange={setQueryDraft}
          onApply={applySearchQuery}
          onClear={clearFilters}
          summaryLine={`${formatNumber(totalCauseTags)} root cause tags across ${formatNumber(uniqueCauses)} unique causes`}
          loading={loading}
          loadingStatusText={loadingStatusText}
          loadingProgressPct={progress.loadingProgressPct}
          lastLoadMs={progress.lastLoadMs}
          metaLine={metaLine}
        />

        {/* ---- year filter bar ---- */}
        <YearFilterBar
          availableYears={availableYears}
          activeYears={filters.years}
          onToggleYear={toggleYear}
          onSelectAll={setYears}
          onClearYears={() => setYears([])}
          accentColor="purple"
        />

        {/* ---- active filter pills ---- */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {filters.query && <FilterPill label={`Query: ${filters.query}`} onClear={() => setFilters((prev) => ({ ...prev, query: '', page: 1 }))} />}
            {filters.years.map((year) => (
              <FilterPill key={`year-${year}`} label={`Year ${year}`} onClear={() => toggleYear(year)} />
            ))}
            {filters.products.map((product) => (
              <FilterPill key={`product-${product}`} label={`Product: ${product}`} onClear={() => toggleProduct(product)} />
            ))}
            {filters.firms.map((firm) => (
              <FilterPill key={`firm-${firm}`} label={`Firm: ${firm}`} onClear={() => toggleFirm(firm)} />
            ))}
            {filters.tags.map((tag) => (
              <FilterPill key={`tag-${tag}`} label={`Tag: ${tag}`} onClear={() => toggleTag(tag)} />
            ))}
          </div>
        )}

        {/* ---- error ---- */}
        {error && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span>{error}</span>
            <button
              onClick={() => void fetchRootCauses(filters)}
              className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-400"
            >
              Retry now
            </button>
          </section>
        )}

        {/* ---- KPI cards ---- */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading && !snapshot ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <KpiCard label="Total root cause tags" value={formatNumber(totalCauseTags)} helper="Aggregate tag occurrences across all decisions." accent="bg-purple-400" />
              <KpiCard label="Unique causes" value={formatNumber(uniqueCauses)} helper="Distinct root cause labels in the filtered corpus." accent="bg-teal-400" />
              <KpiCard label="Top root cause" value={topCause} helper="Most frequently occurring root cause tag." accent="bg-indigo-400" />
              <KpiCard label="Categories" value={formatNumber(categoryCount)} helper="Broad category groupings for root causes." accent="bg-cyan-400" />
            </>
          )}
        </section>

        {/* ---- sunburst chart + top causes table ---- */}
        <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr] xl:items-start">
          <ExpandableCard title="Root cause hierarchy" description="Inner ring: broad categories. Outer ring: specific causes." interactionHint="Click a ring segment to filter by that root cause category or tag.">
            {snapshot ? (
              <SunburstChart hierarchy={snapshot.hierarchy} onToggleTag={toggleTag} />
            ) : (
              <div className="h-[420px] animate-pulse rounded-xl bg-slate-100" />
            )}
          </ExpandableCard>

          <ExpandableCard title="Top root causes" description="Most frequent causes with year-over-year trend sparklines." interactionHint="Click a row to filter by that root cause.">
            {snapshot ? (
              <div className="max-h-[420px] overflow-y-auto">
                <TopCausesTable rootCauses={snapshot.rootCauses} onToggleTag={toggleTag} activeTags={filters.tags} />
              </div>
            ) : (
              <div className="h-[420px] animate-pulse rounded-xl bg-slate-100" />
            )}
          </ExpandableCard>
        </section>

        {/* ---- treemap (full width) ---- */}
        <section>
          <ExpandableCard title="Root cause frequency treemap" description="Block size proportional to occurrence count. Hover for details." interactionHint="Click a block to filter by that root cause tag.">
            {snapshot ? (
              <CauseTreemap frequency={snapshot.frequency} onToggleTag={toggleTag} />
            ) : (
              <div className="h-[480px] animate-pulse rounded-xl bg-slate-100" />
            )}
          </ExpandableCard>
        </section>

        {/* ---- empty state ---- */}
        {!loading && !error && snapshot && totalCauseTags === 0 && hasActiveFilters && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No root cause data for current filters. Clear one or more filters to widen scope.
          </section>
        )}
      </div>
    </main>
  );
}
