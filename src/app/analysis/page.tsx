'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFosFilters } from '@/hooks/use-fos-filters';
import { useFosAnalysis } from '@/hooks/use-fos-analysis';
import { SearchBar } from '@/components/dashboard/search-bar';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { FilterPill } from '@/components/shared/filter-pills';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { HeatmapTable } from '@/components/analysis/heatmap-table';
import { ProductLeaderboard } from '@/components/analysis/product-leaderboard';
import { FirmBenchmark } from '@/components/analysis/firm-benchmark';
import { PrecedentMatrix } from '@/components/analysis/precedent-matrix';
import { ProductTree } from '@/components/analysis/product-tree';
import { YearNarratives } from '@/components/analysis/year-narratives';
import { UpheldRateGauge } from '@/components/analysis/upheld-rate-gauge';
import { ProductBubbleChart } from '@/components/analysis/product-bubble-chart';
import { CategoriesByMonth } from '@/components/analysis/categories-by-month';
import { DecisionsHeatmap } from '@/components/analysis/decisions-heatmap';
import { formatNumber, formatPercent, formatDateTime } from '@/lib/utils';

export default function AnalysisPage() {
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
    applySearchQuery,
    clearFilters,
    setFilters,
  } = useFosFilters();

  const { snapshot, loading, error, meta, progress, fetchAnalysis } = useFosAnalysis(filters, initialized);

  /* ---- derived metrics ---- */
  const yearRollup = useMemo(() => {
    if (!snapshot) return [];
    const byYear = new Map<number, { year: number; total: number; upheld: number; notUpheld: number }>();
    for (const row of snapshot.yearProductOutcome) {
      const existing = byYear.get(row.year) || { year: row.year, total: 0, upheld: 0, notUpheld: 0 };
      existing.total += row.total;
      existing.upheld += row.upheld;
      existing.notUpheld += row.notUpheld;
      byYear.set(row.year, existing);
    }
    return Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  }, [snapshot]);

  const totalCases = useMemo(() => yearRollup.reduce((sum, r) => sum + r.total, 0), [yearRollup]);
  const upheldCases = useMemo(() => yearRollup.reduce((sum, r) => sum + r.upheld, 0), [yearRollup]);
  const notUpheldCases = useMemo(() => yearRollup.reduce((sum, r) => sum + r.notUpheld, 0), [yearRollup]);
  const upheldRate = totalCases ? (upheldCases / totalCases) * 100 : 0;
  const availableYears = useMemo(() => yearRollup.map((r) => r.year), [yearRollup]);

  const loadingStatusText = useMemo(() => {
    if (!loading) return null;
    const phase =
      progress.loadingElapsedSec < 2
        ? 'Building filtered corpus'
        : progress.loadingElapsedSec < 6
          ? 'Computing chart aggregates'
          : 'Rendering analytics view';
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
        <div className="sticky top-0 z-40 h-1 w-full overflow-hidden bg-blue-100/80">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-teal-600 to-blue-600" />
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-5 px-4 py-5 md:px-8">
        {/* ---- header ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Deep Analysis Workspace</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Drill into year, firm, product, precedent, and root-cause patterns across the FOS corpus.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            {loadingStatusText || metaLine || 'Awaiting analysis data'}
          </p>
        </div>

        {/* ---- search + filters ---- */}
        <SearchBar
          queryDraft={queryDraft}
          onQueryDraftChange={setQueryDraft}
          onApply={applySearchQuery}
          onClear={clearFilters}
          summaryLine={`${formatNumber(totalCases)} decisions in scope`}
          loading={loading}
          loadingStatusText={loadingStatusText}
          loadingProgressPct={progress.loadingProgressPct}
          lastLoadMs={progress.lastLoadMs}
          metaLine={metaLine}
        />

        {/* ---- year filter pills ---- */}
        <div className="flex flex-wrap gap-2">
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => toggleYear(year)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                filters.years.includes(year)
                  ? 'border-teal-300 bg-teal-100 text-teal-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-teal-200'
              }`}
            >
              {year}
            </button>
          ))}
        </div>

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
              onClick={() => void fetchAnalysis(filters)}
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
              <KpiCard label="Decisions in scope" value={formatNumber(totalCases)} helper="Filtered corpus volume." accent="bg-blue-400" />
              <KpiCard label="Upheld rate" value={formatPercent(upheldRate)} helper={`${formatNumber(upheldCases)} upheld`} accent="bg-emerald-400" />
              <KpiCard label="Not upheld rate" value={totalCases ? formatPercent((notUpheldCases / totalCases) * 100) : '0.0%'} helper={`${formatNumber(notUpheldCases)} not upheld`} accent="bg-rose-400" />
              <KpiCard label="Firm rows benchmarked" value={formatNumber(snapshot?.firmBenchmark.length || 0)} helper="Volume vs adjudication performance." accent="bg-cyan-400" />
            </>
          )}
        </section>

        {/* ---- dual upheld gauges + bubble chart ---- */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Upheld vs Not Upheld rates</CardTitle>
              <p className="text-sm text-slate-500">Overall rates vs 50% baseline threshold.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <UpheldRateGauge upheldRate={upheldRate} label="Upheld rate" color="#06b6d4" />
                <UpheldRateGauge upheldRate={totalCases ? (notUpheldCases / totalCases) * 100 : 0} label="Not upheld rate" color="#f43f5e" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Product performance</CardTitle>
              <p className="text-sm text-slate-500">Products by total cases, upheld rate, and volume.</p>
            </CardHeader>
            <CardContent>
              <ProductBubbleChart yearProductOutcome={snapshot?.yearProductOutcome || []} />
            </CardContent>
          </Card>
        </section>

        {/* ---- heatmap + product leaderboard ---- */}
        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr] xl:items-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Year x product upheld-rate heatmap</CardTitle>
              <p className="text-sm text-slate-500">Click any cell to combine year and product filters.</p>
            </CardHeader>
            <CardContent>
              <HeatmapTable
                yearProductOutcome={snapshot?.yearProductOutcome || []}
                activeYears={filters.years}
                activeProducts={filters.products}
                onToggleYear={toggleYear}
                onToggleProduct={toggleProduct}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Product upheld-rate leaderboard</CardTitle>
              <p className="text-sm text-slate-500">Products ranked by volume with upheld rate.</p>
            </CardHeader>
            <CardContent>
              <ProductLeaderboard
                yearProductOutcome={snapshot?.yearProductOutcome || []}
                activeProducts={filters.products}
                onToggleProduct={toggleProduct}
              />
            </CardContent>
          </Card>
        </section>

        {/* ---- firm benchmark + precedent matrix ---- */}
        <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr] xl:items-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Firm benchmark: volume vs upheld rate</CardTitle>
              <p className="text-sm text-slate-500">Compare firm scale against adjudication outcomes.</p>
            </CardHeader>
            <CardContent>
              <FirmBenchmark
                firmBenchmark={snapshot?.firmBenchmark || []}
                activeFirms={filters.firms}
                onToggleFirm={toggleFirm}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Precedent x root-cause matrix</CardTitle>
              <p className="text-sm text-slate-500">Click chips to filter by precedent or root cause tags.</p>
            </CardHeader>
            <CardContent>
              <PrecedentMatrix
                matrix={snapshot?.precedentRootCauseMatrix || []}
                activeTags={filters.tags}
                onToggleTag={toggleTag}
              />
            </CardContent>
          </Card>
        </section>

        {/* ---- categories by month + decisions heatmap ---- */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Product categories by month</CardTitle>
              <p className="text-sm text-slate-500">Stacked breakdown of top product sectors by decision month.</p>
            </CardHeader>
            <CardContent>
              <CategoriesByMonth monthlyProductBreakdown={snapshot?.monthlyProductBreakdown || []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Decisions heatmap</CardTitle>
              <p className="text-sm text-slate-500">Decision distribution by month and day of week.</p>
            </CardHeader>
            <CardContent>
              <DecisionsHeatmap decisionDayMonthGrid={snapshot?.decisionDayMonthGrid || []} />
            </CardContent>
          </Card>
        </section>

        {/* ---- product tree + year narratives ---- */}
        <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr] xl:items-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Product to firm distribution</CardTitle>
              <p className="text-sm text-slate-500">High-volume products with their top firms.</p>
            </CardHeader>
            <CardContent>
              <ProductTree
                productTree={snapshot?.productTree || []}
                activeProducts={filters.products}
                activeFirms={filters.firms}
                onToggleProduct={toggleProduct}
                onToggleFirm={toggleFirm}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Yearly analysis narratives</CardTitle>
              <p className="text-sm text-slate-500">Auto-generated commentary from year-level volumes and rates.</p>
            </CardHeader>
            <CardContent>
              <YearNarratives
                yearNarratives={snapshot?.yearNarratives || []}
                activeYears={filters.years}
                onToggleYear={toggleYear}
              />
            </CardContent>
          </Card>
        </section>

        {/* ---- empty state ---- */}
        {!loading && !error && snapshot && totalCases === 0 && hasActiveFilters && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No results for current filters. Clear one or more chips to widen scope.
          </section>
        )}
      </div>
    </main>
  );
}
