'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, ClipboardList, FileBarChart, GitCompare, Search as SearchIcon } from 'lucide-react';
import { ExpandableCard } from '@/components/shared/expandable-card';
import { useFosFilters } from '@/hooks/use-fos-filters';
import { useFosDashboard, useCaseDetail } from '@/hooks/use-fos-dashboard';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { SearchBar } from '@/components/dashboard/search-bar';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { OutcomeDonut } from '@/components/dashboard/outcome-donut';
import { ProductBarChart } from '@/components/dashboard/product-bar-chart';
import { FirmConcentration } from '@/components/dashboard/firm-concentration';
import { CaseExplorer } from '@/components/dashboard/case-explorer';
import { CaseDetailSheet } from '@/components/dashboard/case-detail-sheet';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { YearFilterBar } from '@/components/shared/year-filter-bar';
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
    setYears,
    setPage,
    applySearchQuery,
    clearFilters,
  } = useFosFilters();

  const { snapshot, loading, error, casesLoading, casesError, responseMeta, progress, fetchDashboard } =
    useFosDashboard(filters, initialized);

  const { selectedCaseId, setSelectedCaseId, selectedCase, caseLoading, caseError } = useCaseDetail();

  const activeProduct = filters.products[0] || null;
  const activeOutcome = filters.outcomes[0] || null;

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

  const availableYears = useMemo(() => {
    if (!snapshot?.trends) return [];
    return snapshot.trends.map((t) => t.year).sort((a, b) => a - b);
  }, [snapshot?.trends]);

  const sparklineData = useMemo(() => {
    if (!snapshot?.trends) return undefined;
    return snapshot.trends.map((t) => ({ value: t.total }));
  }, [snapshot?.trends]);

  return (
    <div className="relative min-h-full pb-20">
      {loading && (
        <div className="sticky top-0 z-40 h-1 w-full overflow-hidden bg-blue-100/80">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-blue-600 to-cyan-500" />
        </div>
      )}

      <div className="relative mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 py-5 md:px-8">
        {/* Header */}
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">Management platform</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              FOS Complaints Intelligence
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Search-first adjudication intelligence from the Financial Ombudsman decisions corpus.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span className={`h-2 w-2 rounded-full ${loading ? 'animate-pulse bg-blue-500' : error ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            {loading
              ? loadingStatusText
              : error
                ? 'Temporarily unavailable'
              : responseMeta?.snapshotAt
                ? `Updated ${formatDateTime(responseMeta.snapshotAt)}`
                : 'Ready'}
          </div>
        </section>

        <nav aria-label="Choose a task" className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm sm:grid-cols-2 xl:grid-cols-3">
          {[
            { href: '/complaints', label: 'Open complaint queue', helper: 'Cases, deadlines and actions', icon: ClipboardList },
            { href: '/board-pack', label: 'Open board reports', helper: 'Build and export a board pack', icon: FileBarChart },
            { href: '#decision-search', label: 'Find a decision', helper: 'Search cases and firms', icon: SearchIcon },
            { href: '#trends', label: 'Understand trends', helper: 'Filter years and outcomes', icon: BarChart3 },
            { href: '/comparison', label: 'Compare firms', helper: 'Benchmark published outcomes', icon: GitCompare },
            { href: '/insights/types', label: 'Explore complaint themes', helper: 'Browse tagged FOS decisions', icon: SearchIcon },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className="group flex items-center gap-3 bg-white px-4 py-3 transition hover:bg-teal-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#102a4e] text-white transition group-hover:bg-teal-700">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{item.helper}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-700" />
              </Link>
            );
          })}
        </nav>

        {/* Search bar (full width) */}
        <section id="decision-search" className="scroll-mt-20">
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
        </section>

        {/* Year filter bar */}
        {availableYears.length > 0 && (
          <section>
            <YearFilterBar
              availableYears={availableYears}
              activeYears={filters.years}
              onToggleYear={toggleYear}
              onSelectAll={setYears}
              onClearYears={() => setYears([])}
              accentColor="blue"
            />
          </section>
        )}

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
        <section className="grid gap-4 md:grid-cols-3">
          {loading && !snapshot ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <KpiCard
                label="Total decisions"
                value={snapshot ? formatNumber(snapshot.overview.totalCases) : null}
                helper="Published final ombudsman decisions in active scope."
                accent="bg-blue-400"
                borderColor="#22c55e"
                sparklineData={sparklineData}
                loading={loading && !snapshot}
              />
              <KpiCard
                label="Upheld rate"
                value={snapshot ? formatPercent(snapshot.overview.upheldRate) : null}
                helper={snapshot ? `${formatNumber(snapshot.overview.upheldCases)} cases upheld` : ''}
                accent="bg-emerald-400"
                borderColor="#f97316"
                loading={loading && !snapshot}
              />
              <KpiCard
                label="Not upheld rate"
                value={snapshot ? formatPercent(snapshot.overview.notUpheldRate) : null}
                helper={snapshot ? `${formatNumber(snapshot.overview.notUpheldCases)} not upheld` : ''}
                accent="bg-rose-400"
                borderColor="#f97316"
                loading={loading && !snapshot}
              />
            </>
          )}
        </section>

        {/* Trend chart (~65%) + Outcome donut (~35%) */}
        <section id="trends" className="grid scroll-mt-20 gap-4 xl:grid-cols-[1.85fr_1fr] xl:items-start">
          <ExpandableCard title="Year trend and drill-down" description="Click a year to filter. Multi-select enabled." interactionHint="Click a dot or year pill to filter all panels by that year.">
            {snapshot ? (
              <TrendChart trends={snapshot.trends} activeYears={filters.years} onToggleYear={toggleYear} />
            ) : (
              <div className="h-[320px] animate-pulse rounded-xl bg-slate-100" />
            )}
          </ExpandableCard>

          <ExpandableCard title="Outcome split" description="Click an outcome to filter every panel." interactionHint="Click a segment or label to filter by outcome type.">
            <OutcomeDonut
              outcomes={snapshot?.outcomes || []}
              activeOutcome={activeOutcome}
              onToggleOutcome={toggleOutcome}
            />
          </ExpandableCard>
        </section>

        {/* Firm and product distributions */}
        <section className="grid items-start gap-4 xl:grid-cols-2">
          <ExpandableCard title="Firm concentration" description="See which firms dominate the active result set." interactionHint="Click a firm bar to filter every panel.">
            {snapshot ? (
              <FirmConcentration
                firms={snapshot.firms}
                overview={snapshot.overview}
                activeFirms={filters.firms}
                onToggleFirm={toggleFirm}
              />
            ) : (
              <div className="h-[240px] animate-pulse rounded-xl bg-slate-100" />
            )}
          </ExpandableCard>
          <ExpandableCard title="Product mix" description="See the products driving the active result set." interactionHint="Click a bar to filter by product.">
            <ProductBarChart
              products={snapshot?.products || []}
              activeProduct={activeProduct}
              onToggleProduct={toggleProduct}
            />
          </ExpandableCard>
        </section>

        {/* Case explorer (full width) */}
        <section id="case-explorer" className="scroll-mt-20">
          <ExpandableCard title="Case Explorer" description="Browse individual case decisions." interactionHint="Click a row to view full case details.">
            <div className="mb-2 flex justify-end">
              <Link
                href="/analysis"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Open deep analysis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <CaseExplorer
              cases={snapshot?.cases || []}
              pagination={snapshot?.pagination || null}
              loading={casesLoading}
              error={casesError}
              onSelectCase={setSelectedCaseId}
              onPageChange={setPage}
              currentPage={filters.page}
            />
          </ExpandableCard>
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
