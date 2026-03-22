'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExpandableCard } from '@/components/shared/expandable-card';
import { useFosFilters } from '@/hooks/use-fos-filters';
import { useFosAnalysis } from '@/hooks/use-fos-analysis';
import { useCaseDetail } from '@/hooks/use-fos-dashboard';
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
import { YearFilterBar } from '@/components/shared/year-filter-bar';
import { OutcomeFilterBar } from '@/components/shared/outcome-filter-bar';
import { SubsetAnalysisPanel } from '@/components/analysis/subset-analysis-panel';
import { SubsetDecisionsTable } from '@/components/analysis/subset-decisions-table';
import { CaseDetailSheet } from '@/components/dashboard/case-detail-sheet';
import { OUTCOME_LABELS } from '@/lib/fos/constants';
import { formatNumber, formatPercent, formatDateTime } from '@/lib/utils';

export default function AnalysisPage() {
  const {
    filters,
    queryDraft,
    setQueryDraft,
    initialized,
    hasActiveFilters,
    toggleYear,
    toggleOutcome,
    toggleProduct,
    toggleFirm,
    toggleTag,
    setYears,
    applySearchQuery,
    clearFilters,
    setFilters,
  } = useFosFilters();

  const { snapshot, loading, error, meta, progress, fetchAnalysis } = useFosAnalysis(filters, initialized);
  const { selectedCaseId, setSelectedCaseId, selectedCase, caseLoading, caseError } = useCaseDetail();

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

        {/* ---- year filter bar ---- */}
        <YearFilterBar
          availableYears={availableYears}
          activeYears={filters.years}
          onToggleYear={toggleYear}
          onSelectAll={setYears}
          onClearYears={() => setYears([])}
          accentColor="teal"
        />

        {/* ---- outcome filter bar ---- */}
        <OutcomeFilterBar
          activeOutcomes={filters.outcomes}
          onToggleOutcome={toggleOutcome}
        />

        {/* ---- active filter pills ---- */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {filters.query && <FilterPill label={`Query: ${filters.query}`} onClear={() => setFilters((prev) => ({ ...prev, query: '', page: 1 }))} />}
            {filters.years.map((year) => (
              <FilterPill key={`year-${year}`} label={`Year ${year}`} onClear={() => toggleYear(year)} />
            ))}
            {filters.outcomes.map((outcome) => (
              <FilterPill key={`outcome-${outcome}`} label={`Outcome: ${OUTCOME_LABELS[outcome]}`} onClear={() => toggleOutcome(outcome)} />
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
          <ExpandableCard title="Upheld vs Not Upheld rates" description="Overall upheld vs not-upheld rates against a 50% baseline. Lower upheld rate is better for firms.">
            <div className="grid grid-cols-2 items-start gap-4 py-4">
              <UpheldRateGauge upheldRate={upheldRate} label="Upheld rate" color="#06b6d4" />
              <UpheldRateGauge upheldRate={totalCases ? (notUpheldCases / totalCases) * 100 : 0} label="Not upheld rate" color="#f43f5e" />
            </div>
          </ExpandableCard>
          <ExpandableCard title="Product performance" description="Products by total cases, upheld rate, and volume." interactionHint="Click a bubble to filter by that product.">
            <ProductBubbleChart yearProductOutcome={snapshot?.yearProductOutcome || []} onToggleProduct={toggleProduct} activeProduct={filters.products[0] || null} />
          </ExpandableCard>
        </section>

        {/* ---- heatmap + product leaderboard ---- */}
        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr] xl:items-start">
          <ExpandableCard title="Year x product upheld-rate heatmap" description="Click any cell to combine year and product filters." interactionHint="Click any cell to combine year and product filters.">
            <HeatmapTable
              yearProductOutcome={snapshot?.yearProductOutcome || []}
              activeYears={filters.years}
              activeProducts={filters.products}
              onToggleYear={toggleYear}
              onToggleProduct={toggleProduct}
            />
          </ExpandableCard>
          <ExpandableCard title="Product upheld-rate leaderboard" description="Products ranked by volume with upheld rate." interactionHint="Click a bar to filter by that product.">
            <ProductLeaderboard
              yearProductOutcome={snapshot?.yearProductOutcome || []}
              activeProducts={filters.products}
              onToggleProduct={toggleProduct}
            />
          </ExpandableCard>
        </section>

        {/* ---- firm benchmark + precedent matrix ---- */}
        <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr] xl:items-start">
          <ExpandableCard title="Firm benchmark: volume vs upheld rate" description="Compare firm scale against adjudication outcomes." interactionHint="Click a bar to filter by that firm.">
            <FirmBenchmark
              firmBenchmark={snapshot?.firmBenchmark || []}
              activeFirms={filters.firms}
              onToggleFirm={toggleFirm}
            />
          </ExpandableCard>
          <ExpandableCard title="Precedent x root-cause matrix" description="Click chips to filter by precedent or root cause tags." interactionHint="Click chips or cells to filter by precedent or root cause tags.">
            <PrecedentMatrix
              matrix={snapshot?.precedentRootCauseMatrix || []}
              activeTags={filters.tags}
              onToggleTag={toggleTag}
            />
          </ExpandableCard>
        </section>

        {/* ---- categories by month + decisions heatmap ---- */}
        <section className="grid gap-4 md:grid-cols-2">
          <ExpandableCard title="Product categories by month" description="Stacked breakdown of top product sectors by decision month." interactionHint="Click a bar segment to filter by that product.">
            <CategoriesByMonth monthlyProductBreakdown={snapshot?.monthlyProductBreakdown || []} onToggleProduct={toggleProduct} activeProducts={filters.products} />
          </ExpandableCard>
          <ExpandableCard title="Decisions heatmap" description="Heat intensity shows decision volume by day of week and month. Darker = more decisions.">
            <DecisionsHeatmap decisionDayMonthGrid={snapshot?.decisionDayMonthGrid || []} />
          </ExpandableCard>
        </section>

        {/* ---- product tree + year narratives ---- */}
        <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr] xl:items-start">
          <ExpandableCard title="Product to firm distribution" description="High-volume products with their top firms." interactionHint="Click a product badge or firm card to filter.">
            <ProductTree
              productTree={snapshot?.productTree || []}
              activeProducts={filters.products}
              activeFirms={filters.firms}
              onToggleProduct={toggleProduct}
              onToggleFirm={toggleFirm}
            />
          </ExpandableCard>
          <ExpandableCard title="Yearly analysis narratives" description="Auto-generated commentary from year-level volumes and rates." interactionHint="Click a year badge to filter by that year.">
            <YearNarratives
              yearNarratives={snapshot?.yearNarratives || []}
              activeYears={filters.years}
              onToggleYear={toggleYear}
            />
          </ExpandableCard>
        </section>

        {/* ---- deep analysis section ---- */}
        {snapshot && totalCases > 0 && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
              <h2 className="mb-1 text-lg font-semibold text-slate-900">Deep Analysis</h2>
              <p className="mb-4 text-sm text-slate-600">
                Generate an AI-powered analysis of why these decisions went the way they did, and browse matching cases.
              </p>
              <SubsetAnalysisPanel filters={filters} totalCases={totalCases} />
              <div className="mt-4 border-t border-slate-200 pt-4">
                <SubsetDecisionsTable filters={filters} totalCases={totalCases} onSelectCase={setSelectedCaseId} />
              </div>
            </div>
          </section>
        )}

        {/* ---- empty state ---- */}
        {!loading && !error && snapshot && totalCases === 0 && hasActiveFilters && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No results for current filters. Clear one or more chips to widen scope.
          </section>
        )}
      </div>

      {/* ---- case detail sheet ---- */}
      <CaseDetailSheet
        open={!!selectedCaseId}
        onOpenChange={(open) => !open && setSelectedCaseId(null)}
        caseDetail={selectedCase}
        loading={caseLoading}
        error={caseError}
      />
    </main>
  );
}
