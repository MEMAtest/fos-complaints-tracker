'use client';

import { useMemo } from 'react';
import { useFosFilters } from '@/hooks/use-fos-filters';
import { useFosDashboard, useCaseDetail } from '@/hooks/use-fos-dashboard';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { SearchBar } from '@/components/dashboard/search-bar';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { OutcomeDonut } from '@/components/dashboard/outcome-donut';
import { ProductBarChart } from '@/components/dashboard/product-bar-chart';
import { FirmConcentration } from '@/components/dashboard/firm-concentration';
import { PrecedentDrilldown } from '@/components/dashboard/precedent-drilldown';
import { CaseExplorer } from '@/components/dashboard/case-explorer';
import { CaseDetailSheet } from '@/components/dashboard/case-detail-sheet';
import { IngestionPanel } from '@/components/dashboard/ingestion-panel';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { formatNumber, formatPercent, formatDate, formatDateTime } from '@/lib/utils';

export default function FOSComplaintsDashboardPage() {
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
    setTagFilter,
    setPage,
    applySearchQuery,
    clearFilters,
  } = useFosFilters();

  const { snapshot, loading, error, casesLoading, casesError, responseMeta, progress, fetchDashboard } =
    useFosDashboard(filters, initialized);

  const { selectedCaseId, setSelectedCaseId, selectedCase, caseLoading, caseError } = useCaseDetail();

  const activeProduct = filters.products[0] || null;
  const activeOutcome = filters.outcomes[0] || null;
  const activeTag = filters.tags[0] || null;

  const loadingStatusText = useMemo(() => {
    if (!loading) return null;
    const sec = progress.loadingElapsedSec;
    const phase = sec < 2 ? 'Fetching filtered dataset' : sec < 6 ? 'Aggregating charts and KPIs' : 'Rendering dashboard panels';
    if (progress.estimatedRemainingSec != null) {
      return `${phase} · ${sec}s elapsed · ~${progress.estimatedRemainingSec}s remaining`;
    }
    return `${phase} · ${sec}s elapsed`;
  }, [loading, progress.loadingElapsedSec, progress.estimatedRemainingSec]);

  const summaryLine = useMemo(() => {
    if (!snapshot) return '';
    const total = formatNumber(snapshot.overview.totalCases);
    const from = snapshot.overview.earliestDecisionDate ? formatDate(snapshot.overview.earliestDecisionDate) : 'n/a';
    const to = snapshot.overview.latestDecisionDate ? formatDate(snapshot.overview.latestDecisionDate) : 'n/a';
    return `Showing ${total} decisions, covering ${from} to ${to}.`;
  }, [snapshot]);

  const metaLine = useMemo(() => {
    if (!responseMeta) return null;
    return `${responseMeta.cached ? 'cache hit' : 'fresh query'} · ${responseMeta.queryMs}ms`;
  }, [responseMeta]);

  const sparklineData = useMemo(() => {
    if (!snapshot?.trends) return undefined;
    return snapshot.trends.map((t) => ({ value: t.total }));
  }, [snapshot?.trends]);

  return (
    <div className="relative min-h-full bg-[#f5f8ff] pb-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(37,99,235,0.16),transparent_42%),radial-gradient(circle_at_88%_8%,rgba(14,165,233,0.12),transparent_38%)]" />

      {loading && (
        <div className="sticky top-0 z-40 h-1 w-full overflow-hidden bg-blue-100/80">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-blue-600 to-cyan-500" />
        </div>
      )}

      <div className="relative mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 py-5 md:px-8">
        {/* Header section */}
        <section className="overflow-hidden rounded-3xl border border-sky-200 bg-white/95 p-5 shadow-xl shadow-blue-100/70">
          <div className="relative">
            <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-cyan-200/40 blur-3xl" />
            <div className="absolute -left-16 -bottom-20 h-56 w-56 rounded-full bg-blue-300/35 blur-3xl" />
            <div className="relative z-10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">MEMA Consultants</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 md:text-[2.6rem]">
                    FOS Complaints Intelligence
                  </h1>
                  <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
                    Search-first adjudication intelligence from the Financial Ombudsman decisions corpus.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${loading ? 'animate-pulse bg-blue-500' : 'bg-emerald-500'}`} />
                  {loading
                    ? loadingStatusText
                    : responseMeta?.snapshotAt
                      ? `Updated ${formatDateTime(responseMeta.snapshotAt)}`
                      : 'Ready'}
                </div>
              </div>

              <div className="mt-5">
                <SearchBar
                  queryDraft={queryDraft}
                  onQueryDraftChange={setQueryDraft}
                  onApply={applySearchQuery}
                  onClear={clearFilters}
                  summaryLine={summaryLine}
                  loading={loading}
                  loadingStatusText={loadingStatusText}
                  loadingProgressPct={progress.loadingProgressPct}
                  lastLoadMs={progress.lastLoadMs}
                  metaLine={metaLine}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Error banner */}
        {error && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span>{error}</span>
            <button
              onClick={() => void fetchDashboard(filters)}
              className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-400"
            >
              Retry now
            </button>
          </section>
        )}

        {!loading && !error && snapshot && snapshot.overview.totalCases === 0 && hasActiveFilters && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No results for current filters. Try broader terms or clear filters.
          </section>
        )}

        {/* KPI cards */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {loading && !snapshot ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <KpiCard
                label="Total decisions"
                value={snapshot ? formatNumber(snapshot.overview.totalCases) : null}
                helper="Published final ombudsman decisions in active scope."
                accent="bg-blue-400"
                sparklineData={sparklineData}
                loading={loading && !snapshot}
              />
              <KpiCard
                label="Upheld rate"
                value={snapshot ? formatPercent(snapshot.overview.upheldRate) : null}
                helper={snapshot ? `${formatNumber(snapshot.overview.upheldCases)} cases upheld` : ''}
                accent="bg-emerald-400"
                loading={loading && !snapshot}
              />
              <KpiCard
                label="Not upheld rate"
                value={snapshot ? formatPercent(snapshot.overview.notUpheldRate) : null}
                helper={snapshot ? `${formatNumber(snapshot.overview.notUpheldCases)} not upheld` : ''}
                accent="bg-rose-400"
                loading={loading && !snapshot}
              />
              <KpiCard
                label="Top root cause"
                value={snapshot?.overview.topRootCause || 'n/a'}
                helper="Most frequent root-cause tag in filtered corpus."
                accent="bg-cyan-400"
                onClick={
                  snapshot?.overview.topRootCause && snapshot.overview.topRootCause !== 'n/a'
                    ? () => setTagFilter(snapshot.overview.topRootCause as string)
                    : undefined
                }
                loading={loading && !snapshot}
              />
              <KpiCard
                label="Top precedent"
                value={snapshot?.overview.topPrecedent || 'n/a'}
                helper="Most cited rule/principle in filtered corpus."
                accent="bg-indigo-400"
                onClick={
                  snapshot?.overview.topPrecedent && snapshot.overview.topPrecedent !== 'n/a'
                    ? () => setTagFilter(snapshot.overview.topPrecedent as string)
                    : undefined
                }
                loading={loading && !snapshot}
              />
            </>
          )}
        </section>

        {/* Trend chart + Ingestion */}
        <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr] xl:items-start">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Year trend and drill-down</h2>
                <p className="text-sm text-slate-500">Click a year to filter. Multi-select enabled.</p>
              </div>
              {filters.years.length > 0 && (
                <span className="text-xs text-slate-500">{filters.years.length} selected</span>
              )}
            </div>
            {snapshot ? (
              <TrendChart trends={snapshot.trends} activeYears={filters.years} onToggleYear={toggleYear} />
            ) : (
              <div className="h-[260px] animate-pulse rounded-xl bg-slate-100" />
            )}
          </article>

          <IngestionPanel
            ingestion={snapshot?.ingestion || null}
            dataQuality={snapshot?.dataQuality || null}
            loading={loading}
          />
        </section>

        {/* Outcome donut + Product bar + Precedent drilldown */}
        <section className="grid gap-4 xl:grid-cols-3 xl:items-start">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Outcome split</h3>
            <p className="mt-1 mb-4 text-sm text-slate-500">Click an outcome to filter every panel.</p>
            <OutcomeDonut
              outcomes={snapshot?.outcomes || []}
              activeOutcome={activeOutcome}
              onToggleOutcome={toggleOutcome}
            />
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Product mix</h3>
            <p className="mt-1 mb-4 text-sm text-slate-500">Click a bar to filter by product.</p>
            <ProductBarChart
              products={snapshot?.products || []}
              activeProduct={activeProduct}
              onToggleProduct={toggleProduct}
            />
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Precedent and root-cause drill-down</h3>
            <p className="mt-1 mb-4 text-sm text-slate-500">Click a bar to filter by tag.</p>
            <div className="space-y-4">
              <PrecedentDrilldown
                title="Top precedents"
                items={snapshot?.precedents || []}
                activeTag={activeTag}
                onToggle={setTagFilter}
              />
              <PrecedentDrilldown
                title="Top root causes"
                items={snapshot?.rootCauses || []}
                activeTag={activeTag}
                onToggle={setTagFilter}
              />
            </div>
          </article>
        </section>

        {/* Yearly insights */}
        {snapshot && snapshot.insights.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Yearly analysis snapshots</h2>
            <p className="text-sm text-slate-500">Generated trend summaries for each year in scope.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.insights.map((insight) => (
                <article key={insight.year} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{insight.year}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{insight.headline}</h3>
                  <p className="mt-2 text-sm text-slate-600">{insight.detail}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Case explorer + Firm concentration */}
        <section className="grid gap-4 xl:grid-cols-[1fr_360px] xl:items-start">
          <CaseExplorer
            cases={snapshot?.cases || []}
            pagination={snapshot?.pagination || null}
            loading={casesLoading}
            error={casesError}
            onSelectCase={setSelectedCaseId}
            onPageChange={setPage}
            currentPage={filters.page}
          />

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Firm concentration</h3>
            <p className="mt-1 mb-4 text-sm text-slate-500">Share of case volume by top firms.</p>
            {snapshot ? (
              <FirmConcentration
                firms={snapshot.firms}
                overview={snapshot.overview}
                activeFirms={filters.firms}
                onToggleFirm={toggleFirm}
              />
            ) : (
              <div className="h-[300px] animate-pulse rounded-xl bg-slate-100" />
            )}
          </article>
        </section>
      </div>

      {/* Case detail sheet */}
      <CaseDetailSheet
        open={!!selectedCaseId}
        onOpenChange={(open) => { if (!open) setSelectedCaseId(null); }}
        caseDetail={selectedCase}
        loading={caseLoading}
        error={caseError}
      />
    </div>
  );
}
