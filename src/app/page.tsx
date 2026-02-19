'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FOSCaseDetail, FOSDashboardFilters, FOSDashboardSnapshot, FOSOutcome } from '@/lib/fos/types';
import { FOSCaseDetailApiResponse, FOSDashboardApiResponse } from '@/types/fos-dashboard';

const OUTCOME_LABELS: Record<FOSOutcome, string> = {
  upheld: 'Upheld',
  not_upheld: 'Not upheld',
  partially_upheld: 'Partially upheld',
  settled: 'Settled',
  not_settled: 'Not settled',
  unknown: 'Unknown',
};

const STATUS_STYLES: Record<
  'running' | 'idle' | 'warning' | 'error',
  { badge: string; dot: string; label: string }
> = {
  running: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Running' },
  idle: { badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-500', label: 'Idle' },
  warning: { badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Warning' },
  error: { badge: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500', label: 'Error' },
};

const INITIAL_FILTERS: FOSDashboardFilters = {
  query: '',
  years: [],
  outcomes: [],
  products: [],
  firms: [],
  tags: [],
  page: 1,
  pageSize: 25,
};

function parseFiltersFromQueryString(search: string): FOSDashboardFilters {
  const params = new URLSearchParams(search);
  const parseStringList = (key: string): string[] =>
    Array.from(
      new Set(
        params
          .getAll(key)
          .flatMap((value) => value.split(','))
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );

  const parseNumberList = (key: string): number[] =>
    parseStringList(key)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value))
      .sort((a, b) => a - b);

  const outcomes = parseStringList('outcome').filter((value): value is FOSOutcome =>
    ['upheld', 'not_upheld', 'partially_upheld', 'settled', 'not_settled', 'unknown'].includes(value)
  );

  return {
    query: (params.get('query') || '').trim(),
    years: parseNumberList('year'),
    outcomes,
    products: parseStringList('product'),
    firms: parseStringList('firm'),
    tags: parseStringList('tag'),
    page: parsePositiveInt(params.get('page'), 1),
    pageSize: clamp(parsePositiveInt(params.get('pageSize'), 25), 5, 100),
  };
}

function buildQueryParams(filters: FOSDashboardFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.query) params.set('query', filters.query);
  filters.years.forEach((year) => params.append('year', String(year)));
  filters.outcomes.forEach((outcome) => params.append('outcome', outcome));
  filters.products.forEach((product) => params.append('product', product));
  filters.firms.forEach((firm) => params.append('firm', firm));
  filters.tags.forEach((tag) => params.append('tag', tag));
  params.set('page', String(filters.page));
  params.set('pageSize', String(filters.pageSize));

  return params;
}

function DashboardKpiCard({
  label,
  value,
  helper,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  helper: string;
  accent: string;
  onClick?: () => void;
}) {
  const card = (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
        onClick ? 'cursor-pointer transition hover:border-blue-300 hover:shadow-md' : ''
      }`}
    >
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 ${accent}`} />
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );

  if (!onClick) return card;

  return (
    <button onClick={onClick} className="w-full text-left">
      {card}
    </button>
  );
}

function TrendBars({
  snapshot,
  activeYears,
  onToggleYear,
}: {
  snapshot: FOSDashboardSnapshot;
  activeYears: number[];
  onToggleYear: (year: number) => void;
}) {
  const maxTotal = Math.max(...snapshot.trends.map((item) => item.total), 1);

  if (snapshot.trends.length === 0) {
    return <EmptyState label="No yearly trend data matches the current filters." />;
  }

  return (
    <div className="space-y-3">
      {snapshot.trends.map((item) => {
        const isActive = activeYears.includes(item.year);
        const width = (item.total / maxTotal) * 100;
        const upheldShare = item.total > 0 ? (item.upheld / item.total) * 100 : 0;
        const notUpheldShare = item.total > 0 ? (item.notUpheld / item.total) * 100 : 0;
        const partialShare = Math.max(0, 100 - upheldShare - notUpheldShare);

        return (
          <button
            key={item.year}
            onClick={() => onToggleYear(item.year)}
            className={`w-full rounded-xl border p-3 text-left transition ${
              isActive ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50'
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">{item.year}</p>
              <p className="text-sm text-slate-600">{formatNumber(item.total)} decisions</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${width}%` }} />
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full border border-slate-200">
              <span className="bg-emerald-500" style={{ width: `${upheldShare}%` }} />
              <span className="bg-rose-500" style={{ width: `${notUpheldShare}%` }} />
              <span className="bg-indigo-400" style={{ width: `${partialShare}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Upheld {formatPercent(upheldShare)}</span>
              <span>Not upheld {formatPercent(notUpheldShare)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function HorizontalBars({
  title,
  items,
  activeValue,
  onToggle,
  valueFormatter,
  className,
}: {
  title: string;
  items: Array<{ label: string; total: number; rate: number }>;
  activeValue: string | null;
  onToggle: (value: string) => void;
  valueFormatter: (item: { label: string; total: number; rate: number }) => string;
  className?: string;
}) {
  const max = Math.max(...items.map((item) => item.total), 1);

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className || ''}`}>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.length === 0 && <EmptyState label="No records for this view." />}
        {items.map((item) => {
          const active = activeValue === item.label;
          const width = (item.total / max) * 100;
          return (
            <button
              key={item.label}
              onClick={() => onToggle(item.label)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                active ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="line-clamp-1 text-sm font-medium text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-600">{valueFormatter(item)}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${width}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TagBars({
  title,
  items,
  activeTag,
  onToggle,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  activeTag: string | null;
  onToggle: (tag: string) => void;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length === 0 && <EmptyState label={`No ${title.toLowerCase()} for this scope.`} />}
        {items.map((item) => {
          const active = activeTag === item.label;
          const width = (item.count / max) * 100;
          return (
            <button
              key={`${title}-${item.label}`}
              onClick={() => onToggle(item.label)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                active ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="line-clamp-1 text-xs font-medium text-slate-800">{item.label}</span>
                <span className="text-xs text-slate-600">{formatNumber(item.count)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${width}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

export default function FOSComplaintsDashboardPage() {
  const [filters, setFilters] = useState<FOSDashboardFilters>(INITIAL_FILTERS);
  const [queryDraft, setQueryDraft] = useState('');
  const [snapshot, setSnapshot] = useState<FOSDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<FOSCaseDetail | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const dashboardRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const parsed = parseFiltersFromQueryString(window.location.search);
    setFilters(parsed);
    setQueryDraft(parsed.query);
    setInitialized(true);
  }, []);

  const fetchDashboard = useCallback(async (nextFilters: FOSDashboardFilters) => {
    dashboardRequestRef.current?.abort();
    const controller = new AbortController();
    dashboardRequestRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 25_000);

    setLoading(true);
    setError(null);

    try {
      const params = buildQueryParams(nextFilters);
      const response = await fetch(`/api/fos/dashboard?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = (await response.json()) as FOSDashboardApiResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error('Unable to load dashboard data.');
      }

      setSnapshot(payload.data);
      setFilters((prev) => (prev.page === payload.data.pagination.page ? prev : { ...prev, page: payload.data.pagination.page }));
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        return;
      }
      const message = requestError instanceof Error ? requestError.message : 'Unknown dashboard error';
      setError(message);
    } finally {
      window.clearTimeout(timeoutId);
      if (dashboardRequestRef.current === controller) {
        dashboardRequestRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!initialized) return;
    void fetchDashboard(filters);
  }, [fetchDashboard, filters, initialized]);

  useEffect(() => {
    if (!initialized) return;
    const params = buildQueryParams(filters);
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }, [filters, initialized]);

  useEffect(
    () => () => {
      dashboardRequestRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    if (!selectedCaseId) {
      setSelectedCase(null);
      setCaseError(null);
      return;
    }

    let cancelled = false;
    const loadCase = async () => {
      setCaseLoading(true);
      setCaseError(null);
      try {
        const response = await fetch(`/api/fos/cases/${encodeURIComponent(selectedCaseId)}`, { cache: 'no-store' });
        const payload = (await response.json()) as FOSCaseDetailApiResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || 'Unable to load case detail.');
        }
        if (!cancelled) setSelectedCase(payload.data);
      } catch (requestError) {
        if (!cancelled) {
          const message = requestError instanceof Error ? requestError.message : 'Unknown case detail error';
          setCaseError(message);
        }
      } finally {
        if (!cancelled) setCaseLoading(false);
      }
    };

    void loadCase();
    return () => {
      cancelled = true;
    };
  }, [selectedCaseId]);

  const activeProduct = filters.products[0] || null;
  const activeOutcome = filters.outcomes[0] || null;

  const summaryLine = useMemo(() => {
    if (!snapshot) return '';
    const total = formatNumber(snapshot.overview.totalCases);
    const from = snapshot.overview.earliestDecisionDate ? formatDate(snapshot.overview.earliestDecisionDate) : 'n/a';
    const to = snapshot.overview.latestDecisionDate ? formatDate(snapshot.overview.latestDecisionDate) : 'n/a';
    return `Showing ${total} decisions in scope, covering ${from} to ${to}.`;
  }, [snapshot]);

  const toggleYear = useCallback((year: number) => {
    setFilters((prev) => ({
      ...prev,
      years: toggleNumber(prev.years, year),
      page: 1,
    }));
  }, []);

  const toggleOutcome = useCallback((outcome: FOSOutcome) => {
    setFilters((prev) => ({
      ...prev,
      outcomes: toggleText(prev.outcomes, outcome),
      page: 1,
    }));
  }, []);

  const toggleProduct = useCallback((product: string) => {
    setFilters((prev) => ({
      ...prev,
      products: prev.products.includes(product) ? [] : [product],
      page: 1,
    }));
  }, []);

  const applySearchQuery = useCallback(() => {
    const nextQuery = queryDraft.trim();
    setFilters((prev) => (prev.query === nextQuery ? prev : { ...prev, query: nextQuery, page: 1 }));
  }, [queryDraft]);

  const setTagFilter = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? [] : [tag],
      page: 1,
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({ ...INITIAL_FILTERS, pageSize: prev.pageSize }));
    setQueryDraft('');
  }, []);

  return (
    <main className="relative min-h-screen bg-[#f5f8ff] pb-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(37,99,235,0.16),transparent_42%),radial-gradient(circle_at_88%_8%,rgba(14,165,233,0.12),transparent_38%)]" />
      {loading && (
        <div className="sticky top-0 z-40 h-1 w-full overflow-hidden bg-blue-100/80">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-blue-600 to-cyan-500" />
        </div>
      )}
      <div className="relative mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-6 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-sky-200 bg-white/95 p-6 shadow-xl shadow-blue-100/70">
          <div className="relative">
            <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-cyan-200/40 blur-3xl" />
            <div className="absolute -left-16 -bottom-20 h-56 w-56 rounded-full bg-blue-300/35 blur-3xl" />
            <div className="relative z-10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">MEMA Consultants</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                    FOS Complaints Intelligence
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-slate-600">
                    Search-first adjudication intelligence from the Financial Ombudsman decisions corpus, with live
                    drill-down by year, product, firm, and precedent patterns.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${loading ? 'animate-pulse bg-blue-500' : 'bg-emerald-500'}`} />
                  {loading
                    ? 'Refreshing dashboard...'
                    : snapshot?.ingestion.lastSuccessAt
                      ? `Updated ${formatDateTime(snapshot.ingestion.lastSuccessAt)}`
                      : 'Update timestamp unavailable'}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <label className="block text-xs uppercase tracking-[0.16em] text-slate-500">Global case search</label>
                <input
                  value={queryDraft}
                  onChange={(event) => setQueryDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearchQuery();
                  }}
                  placeholder="Case reference, firm, product, precedent, reasoning keyword..."
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={applySearchQuery}
                    className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-100"
                  >
                    Apply search
                  </button>
                  <button
                    onClick={clearFilters}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
                  >
                    Clear all filters
                  </button>
                  <span className="text-xs text-slate-500">
                    {summaryLine} Press Enter or click &quot;Apply search&quot; to run query.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</section>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <DashboardKpiCard
            label="Total decisions"
            value={snapshot ? formatNumber(snapshot.overview.totalCases) : loading ? '...' : '0'}
            helper="Published final ombudsman decisions in active scope."
            accent="bg-blue-400"
          />
          <DashboardKpiCard
            label="Upheld rate"
            value={snapshot ? formatPercent(snapshot.overview.upheldRate) : loading ? '...' : formatPercent(0)}
            helper={snapshot ? `${formatNumber(snapshot.overview.upheldCases)} cases upheld` : 'Awaiting dashboard response'}
            accent="bg-emerald-400"
          />
          <DashboardKpiCard
            label="Not upheld rate"
            value={snapshot ? formatPercent(snapshot.overview.notUpheldRate) : loading ? '...' : formatPercent(0)}
            helper={snapshot ? `${formatNumber(snapshot.overview.notUpheldCases)} not upheld` : 'Awaiting dashboard response'}
            accent="bg-rose-400"
          />
          <DashboardKpiCard
            label="Top root cause"
            value={snapshot?.overview.topRootCause || 'n/a'}
            helper="Most frequent root-cause tag in filtered corpus."
            accent="bg-cyan-400"
            onClick={
              snapshot?.overview.topRootCause && snapshot.overview.topRootCause !== 'n/a'
                ? () => setTagFilter(snapshot.overview.topRootCause as string)
                : undefined
            }
          />
          <DashboardKpiCard
            label="Top precedent"
            value={snapshot?.overview.topPrecedent || 'n/a'}
            helper="Most cited rule/principle in filtered corpus."
            accent="bg-indigo-400"
            onClick={
              snapshot?.overview.topPrecedent && snapshot.overview.topPrecedent !== 'n/a'
                ? () => setTagFilter(snapshot.overview.topPrecedent as string)
                : undefined
            }
          />
        </section>

        <section className="order-2 grid gap-4 xl:grid-cols-[1.65fr_1fr] xl:items-start">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Year trend and drill-down</h2>
                <p className="text-sm text-slate-500">Multi-select enabled. Click one or more years to filter the dashboard.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{filters.years.length} selected</span>
                {filters.years.length > 0 && (
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, years: [], page: 1 }))}
                    className="rounded-full border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:border-slate-400"
                  >
                    Clear years
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(snapshot?.filters.years || []).map((year) => (
                  <button
                    key={year}
                    onClick={() => toggleYear(year)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      filters.years.includes(year)
                        ? 'border-blue-300 bg-blue-100 text-blue-700'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-blue-200'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
            {snapshot ? (
              <div className="max-h-[360px] overflow-y-auto pr-1">
                <TrendBars snapshot={snapshot} activeYears={filters.years} onToggleYear={toggleYear} />
              </div>
            ) : (
              <EmptyState label={loading ? 'Loading trend data...' : 'No trend data available.'} />
            )}
          </article>

          <article className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Ingestion and quality</h2>
            <p className="mt-1 text-sm text-slate-500">Pipeline health, data freshness, and quality checks.</p>
            {snapshot ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                      STATUS_STYLES[snapshot.ingestion.status].badge
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[snapshot.ingestion.status].dot}`} />
                    {STATUS_STYLES[snapshot.ingestion.status].label}
                  </span>
                  <span className="text-xs text-slate-500">Source: {snapshot.ingestion.source}</span>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <QualityRow
                    label="Last successful run"
                    value={snapshot.ingestion.lastSuccessAt ? formatDateTime(snapshot.ingestion.lastSuccessAt) : 'n/a'}
                  />
                  <QualityRow
                    label="Windows progress"
                    value={
                      snapshot.ingestion.windowsDone != null && snapshot.ingestion.windowsTotal != null
                        ? `${snapshot.ingestion.windowsDone}/${snapshot.ingestion.windowsTotal}`
                        : 'n/a'
                    }
                  />
                  <QualityRow
                    label="Failed windows"
                    value={snapshot.ingestion.failedWindows != null ? String(snapshot.ingestion.failedWindows) : 'n/a'}
                  />
                  <QualityRow label="Missing decision date" value={formatNumber(snapshot.dataQuality.missingDecisionDate)} />
                  <QualityRow label="Unknown outcome rows" value={formatNumber(snapshot.dataQuality.missingOutcome)} />
                  <QualityRow label="Cases with reasoning text" value={formatNumber(snapshot.dataQuality.withReasoningText)} />
                </dl>
              </>
            ) : (
              <EmptyState label={loading ? 'Loading ingestion diagnostics...' : 'No ingestion diagnostics available.'} />
            )}
          </article>
        </section>

        <section className="order-1 grid gap-4 xl:grid-cols-3 xl:items-start">
          <article className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Outcome split</h3>
            <p className="mt-1 text-sm text-slate-500">Click an outcome to filter every panel.</p>
            <div className="mt-4 space-y-2">
              {(snapshot?.outcomes || []).map((item) => {
                const active = activeOutcome === item.outcome;
                return (
                  <button
                    key={item.outcome}
                    onClick={() => toggleOutcome(item.outcome)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                      active ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm text-slate-700">{OUTCOME_LABELS[item.outcome]}</span>
                    <span className="text-sm font-semibold text-slate-900">{formatNumber(item.count)}</span>
                  </button>
                );
              })}
              {(snapshot?.outcomes || []).length === 0 && <EmptyState label="No outcomes under current filters." />}
            </div>
          </article>

          <HorizontalBars
            title="Product mix"
            items={(snapshot?.products || []).map((item) => ({ label: item.product, total: item.total, rate: item.upheldRate }))}
            activeValue={activeProduct}
            onToggle={toggleProduct}
            valueFormatter={(item) => `${formatNumber(item.total)} | upheld ${formatPercent(item.rate)}`}
            className="self-start"
          />

          <article className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Precedent and root-cause drill-down</h3>
            <p className="mt-1 text-sm text-slate-500">Click a bar to filter by that precedent/root-cause tag.</p>
            <div className="mt-4 space-y-4">
              <TagBars
                title="Top precedents"
                items={snapshot?.precedents || []}
                activeTag={filters.tags[0] || null}
                onToggle={setTagFilter}
              />
              <TagBars
                title="Top root causes"
                items={snapshot?.rootCauses || []}
                activeTag={filters.tags[0] || null}
                onToggle={setTagFilter}
              />
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Yearly analysis snapshots</h2>
              <p className="text-sm text-slate-500">Generated trend summaries for each year in scope.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(snapshot?.insights || []).map((insight) => (
              <article key={insight.year} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{insight.year}</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">{insight.headline}</h3>
                <p className="mt-2 text-sm text-slate-600">{insight.detail}</p>
              </article>
            ))}
            {(snapshot?.insights || []).length === 0 && <EmptyState label="No yearly insights available for this filter set." />}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-start">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Case explorer</h2>
              <p className="text-sm text-slate-500">Click a row to open full complaint, reasoning, and decision content.</p>
            </header>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-4 py-3">Case</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Firm</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Outcome</th>
                    <th className="px-4 py-3">Decision logic</th>
                  </tr>
                </thead>
                <tbody>
                  {(snapshot?.cases || []).map((item) => (
                    <tr
                      key={item.caseId}
                      onClick={() => setSelectedCaseId(item.caseId)}
                      className="cursor-pointer border-t border-slate-100 text-sm transition hover:bg-blue-50/60"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">{item.decisionReference}</td>
                      <td className="px-4 py-3 text-slate-600">{item.decisionDate ? formatDate(item.decisionDate) : 'n/a'}</td>
                      <td className="px-4 py-3 text-slate-700">{item.firmName || 'Unknown firm'}</td>
                      <td className="px-4 py-3 text-slate-700">{item.productGroup || 'Unspecified'}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                          {OUTCOME_LABELS[item.outcome]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{truncate(item.decisionLogic || item.decisionSummary || 'n/a', 120)}</td>
                    </tr>
                  ))}
                  {(snapshot?.cases || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10">
                        <EmptyState label={loading ? 'Loading case rows...' : 'No cases match your current filters.'} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
              <p>
                {snapshot
                  ? `${formatNumber(snapshot.pagination.total)} total matches | page ${snapshot.pagination.page} of ${snapshot.pagination.totalPages}`
                  : 'No pagination data'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, filters.page - 1))}
                  disabled={!snapshot || snapshot.pagination.page <= 1}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(Math.min(snapshot?.pagination.totalPages || 1, filters.page + 1))}
                  disabled={!snapshot || snapshot.pagination.page >= snapshot.pagination.totalPages}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </footer>
          </article>

          <article className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Top firms in scope</h3>
            <p className="mt-1 text-sm text-slate-500">High-volume firms under current filters.</p>
            <div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-1">
              {(snapshot?.firms || []).slice(0, 10).map((firm) => (
                <button
                  key={firm.firm}
                  onClick={() => setFilters((prev) => ({ ...prev, firms: prev.firms.includes(firm.firm) ? [] : [firm.firm], page: 1 }))}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    filters.firms.includes(firm.firm)
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <p className="line-clamp-1 text-sm font-medium text-slate-900">{firm.firm}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {formatNumber(firm.total)} cases | upheld {formatPercent(firm.upheldRate)}
                  </p>
                </button>
              ))}
              {(snapshot?.firms || []).length === 0 && <EmptyState label="No firm breakdown available." />}
            </div>
          </article>
        </section>
      </div>

      {selectedCaseId && (
        <div className="fixed inset-0 z-50 flex">
          <button
            onClick={() => setSelectedCaseId(null)}
            className="h-full flex-1 bg-slate-900/45 backdrop-blur-[1px]"
            aria-label="Close case detail"
          />
          <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/20">
            <button
              onClick={() => setSelectedCaseId(null)}
              className="absolute right-4 top-4 rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600"
            >
              Close
            </button>
            {caseLoading && <p className="mt-4 text-sm text-slate-500">Loading case detail...</p>}
            {caseError && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{caseError}</p>}
            {selectedCase && (
              <div className="space-y-5">
                <header className="pr-14">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Case detail</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">{selectedCase.decisionReference}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {selectedCase.decisionDate ? formatDate(selectedCase.decisionDate) : 'Date unavailable'} |{' '}
                    {selectedCase.firmName || 'Unknown firm'} | {selectedCase.productGroup || 'Unspecified'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      {OUTCOME_LABELS[selectedCase.outcome]}
                    </span>
                    {selectedCase.pdfUrl && (
                      <a
                        href={selectedCase.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700"
                      >
                        Open PDF
                      </a>
                    )}
                    {selectedCase.sourceUrl && (
                      <a
                        href={selectedCase.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs text-cyan-700"
                      >
                        Source page
                      </a>
                    )}
                  </div>
                </header>

                <DetailBlock title="Decision logic" text={selectedCase.decisionLogic || selectedCase.decisionSummary || 'Not available.'} />
                <DetailBlock title="The complaint" text={selectedCase.complaintText || 'No explicit complaint section found in source text.'} />
                <DetailBlock title="Firm response" text={selectedCase.firmResponseText || 'No explicit firm-response section found in source text.'} />
                <DetailBlock
                  title="Ombudsman reasoning"
                  text={selectedCase.ombudsmanReasoningText || 'No explicit ombudsman-reasoning section found in source text.'}
                />
                <DetailBlock title="Final decision" text={selectedCase.finalDecisionText || 'No explicit final-decision section found in source text.'} />
                {selectedCase.fullText && (
                  <DetailBlock title="Source text preview" text={truncate(selectedCase.fullText, 2500)} />
                )}

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Smart tags</h3>
                  <div className="mt-3 space-y-3">
                    <TagCluster title="Precedents" values={selectedCase.precedents} />
                    <TagCluster title="Root causes" values={selectedCase.rootCauseTags} />
                    <TagCluster title="Vulnerability flags" values={selectedCase.vulnerabilityFlags} />
                  </div>
                </section>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

function QualityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function DetailBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
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
            <span key={`${title}-${value}`} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700">
              {value}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function toggleNumber(list: number[], value: number): number[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value].sort((a, b) => a - b);
}

function toggleText<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [value];
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatPercent(value: number): string {
  return `${Number(value).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}
