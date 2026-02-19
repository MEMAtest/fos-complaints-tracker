'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FOSAnalysisSnapshot, FOSDashboardFilters } from '@/lib/fos/types';
import { FOSAnalysisApiResponse, FOSApiMeta } from '@/types/fos-dashboard';

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

const ANALYSIS_TIMEOUT_MS = 60_000;

type YearRollup = {
  year: number;
  total: number;
  upheld: number;
  notUpheld: number;
  partiallyUpheld: number;
  upheldRate: number;
  topProduct: string | null;
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

  return {
    query: (params.get('query') || '').trim(),
    years: parseNumberList('year'),
    outcomes: [],
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
  filters.products.forEach((product) => params.append('product', product));
  filters.firms.forEach((firm) => params.append('firm', firm));
  filters.tags.forEach((tag) => params.append('tag', tag));
  params.set('page', String(filters.page));
  params.set('pageSize', String(filters.pageSize));
  return params;
}

export default function AnalysisPage() {
  const [filters, setFilters] = useState<FOSDashboardFilters>(INITIAL_FILTERS);
  const [queryDraft, setQueryDraft] = useState('');
  const [snapshot, setSnapshot] = useState<FOSAnalysisSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<FOSApiMeta | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const [loadingElapsedSec, setLoadingElapsedSec] = useState(0);
  const [averageLoadMs, setAverageLoadMs] = useState<number | null>(null);
  const [lastLoadMs, setLastLoadMs] = useState<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const parsed = parseFiltersFromQueryString(window.location.search);
    setFilters(parsed);
    setQueryDraft(parsed.query);
    setInitialized(true);
  }, []);

  const fetchAnalysis = useCallback(async (nextFilters: FOSDashboardFilters) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ANALYSIS_TIMEOUT_MS);
    const startedAt = Date.now();

    setLoading(true);
    setError(null);
    setRequestStartedAt(startedAt);
    setLoadingElapsedSec(0);

    try {
      const response = await fetch(`/api/fos/analysis?${buildQueryParams(nextFilters).toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      let payload: FOSAnalysisApiResponse | null = null;
      try {
        payload = (await response.json()) as FOSAnalysisApiResponse;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || `Analysis request failed (${response.status}).`);
      }

      const durationMs = Date.now() - startedAt;
      setLastLoadMs(durationMs);
      setAverageLoadMs((previous) => (previous == null ? durationMs : Math.round(previous * 0.65 + durationMs * 0.35)));
      setSnapshot(payload.data);
      setMeta(payload.meta || null);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        if (timedOut) {
          setError(`Analysis query timed out after ${Math.round(ANALYSIS_TIMEOUT_MS / 1000)} seconds. Retry with fewer filters.`);
        }
        return;
      }
      setError(requestError instanceof Error ? requestError.message : 'Unknown analysis error.');
    } finally {
      window.clearTimeout(timeoutId);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
        setRequestStartedAt(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!initialized) return;
    void fetchAnalysis(filters);
  }, [fetchAnalysis, filters, initialized]);

  useEffect(() => {
    if (!initialized) return;
    const params = buildQueryParams(filters);
    const nextUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }, [filters, initialized]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    if (!loading || requestStartedAt == null) return;
    const tick = () => setLoadingElapsedSec(Math.max(0, Math.floor((Date.now() - requestStartedAt) / 1000)));
    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [loading, requestStartedAt]);

  const loadingStatusText = useMemo(() => {
    if (!loading) return null;
    const phase =
      loadingElapsedSec < 2 ? 'Building filtered corpus' : loadingElapsedSec < 6 ? 'Computing chart aggregates' : 'Rendering analytics view';
    if (averageLoadMs != null) {
      const remainingSec = Math.max(0, Math.ceil((averageLoadMs - loadingElapsedSec * 1000) / 1000));
      return `${phase} · ${loadingElapsedSec}s elapsed · ~${remainingSec}s remaining`;
    }
    return `${phase} · ${loadingElapsedSec}s elapsed`;
  }, [averageLoadMs, loading, loadingElapsedSec]);

  const loadingProgressPct = useMemo(() => {
    if (!loading || averageLoadMs == null || averageLoadMs <= 0) return null;
    return clamp(Math.round(((loadingElapsedSec * 1000) / averageLoadMs) * 100), 5, 95);
  }, [averageLoadMs, loading, loadingElapsedSec]);

  const yearRollup = useMemo<YearRollup[]>(() => {
    if (!snapshot) return [];
    const byYear = new Map<number, YearRollup & { topProductTotal: number }>();
    for (const row of snapshot.yearProductOutcome) {
      const existing = byYear.get(row.year) || {
        year: row.year,
        total: 0,
        upheld: 0,
        notUpheld: 0,
        partiallyUpheld: 0,
        upheldRate: 0,
        topProduct: null,
        topProductTotal: 0,
      };
      existing.total += row.total;
      existing.upheld += row.upheld;
      existing.notUpheld += row.notUpheld;
      existing.partiallyUpheld += row.partiallyUpheld;
      if (!existing.topProduct || row.total > existing.topProductTotal) {
        existing.topProduct = row.product;
        existing.topProductTotal = row.total;
      }
      byYear.set(row.year, existing);
    }

    return Array.from(byYear.values())
      .map((row) => ({
        ...row,
        upheldRate: row.total ? (row.upheld / row.total) * 100 : 0,
      }))
      .map(({ topProductTotal: _, ...row }) => row)
      .sort((a, b) => a.year - b.year);
  }, [snapshot]);

  const availableYears = useMemo(() => yearRollup.map((row) => row.year), [yearRollup]);
  const yearMaxTotal = useMemo(() => Math.max(...yearRollup.map((item) => item.total), 1), [yearRollup]);
  const topProducts = useMemo(() => (snapshot?.productTree || []).map((item) => item.product).slice(0, 10), [snapshot]);

  const totalCases = useMemo(() => yearRollup.reduce((sum, row) => sum + row.total, 0), [yearRollup]);
  const upheldCases = useMemo(() => yearRollup.reduce((sum, row) => sum + row.upheld, 0), [yearRollup]);
  const notUpheldCases = useMemo(() => yearRollup.reduce((sum, row) => sum + row.notUpheld, 0), [yearRollup]);

  const hasActiveFilters =
    Boolean(filters.query) || filters.years.length > 0 || filters.products.length > 0 || filters.firms.length > 0 || filters.tags.length > 0;

  const heatmapYears = useMemo(() => yearRollup.slice(-8).map((row) => row.year).reverse(), [yearRollup]);
  const heatmapProducts = useMemo(() => topProducts.slice(0, 6), [topProducts]);

  const heatmapLookup = useMemo(() => {
    const map = new Map<string, { total: number; upheldRate: number }>();
    for (const row of snapshot?.yearProductOutcome || []) {
      map.set(`${row.year}::${row.product}`, { total: row.total, upheldRate: row.upheldRate });
    }
    return map;
  }, [snapshot]);

  const matrixPrecedents = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cell of snapshot?.precedentRootCauseMatrix || []) {
      counts.set(cell.precedent, (counts.get(cell.precedent) || 0) + cell.count);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 7)
      .map(([label]) => label);
  }, [snapshot]);

  const matrixRootCauses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cell of snapshot?.precedentRootCauseMatrix || []) {
      counts.set(cell.rootCause, (counts.get(cell.rootCause) || 0) + cell.count);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 7)
      .map(([label]) => label);
  }, [snapshot]);

  const matrixLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of snapshot?.precedentRootCauseMatrix || []) {
      map.set(`${cell.precedent}::${cell.rootCause}`, cell.count);
    }
    return map;
  }, [snapshot]);

  const matrixMax = useMemo(() => {
    let max = 0;
    for (const value of matrixLookup.values()) max = Math.max(max, value);
    return Math.max(max, 1);
  }, [matrixLookup]);

  const productUpholdLeaderboard = useMemo(() => {
    const grouped = new Map<string, { product: string; total: number; upheld: number }>();
    for (const row of snapshot?.yearProductOutcome || []) {
      const existing = grouped.get(row.product) || { product: row.product, total: 0, upheld: 0 };
      existing.total += row.total;
      existing.upheld += row.upheld;
      grouped.set(row.product, existing);
    }
    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        upheldRate: item.total ? (item.upheld / item.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total || a.product.localeCompare(b.product))
      .slice(0, 8);
  }, [snapshot]);

  const firmBenchmarkMax = useMemo(
    () => Math.max(...(snapshot?.firmBenchmark || []).map((item) => item.total), 1),
    [snapshot]
  );

  const toggleYear = useCallback((year: number) => {
    setFilters((prev) => ({
      ...prev,
      years: prev.years.includes(year) ? prev.years.filter((item) => item !== year) : [...prev.years, year].sort((a, b) => a - b),
      page: 1,
    }));
  }, []);

  const toggleProduct = useCallback((product: string) => {
    setFilters((prev) => ({
      ...prev,
      products: prev.products.includes(product) ? prev.products.filter((item) => item !== product) : [...prev.products, product],
      page: 1,
    }));
  }, []);

  const toggleFirm = useCallback((firm: string) => {
    setFilters((prev) => ({
      ...prev,
      firms: prev.firms.includes(firm) ? prev.firms.filter((item) => item !== firm) : [...prev.firms, firm],
      page: 1,
    }));
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((item) => item !== tag) : [...prev.tags, tag],
      page: 1,
    }));
  }, []);

  const applySearchQuery = useCallback(() => {
    const nextQuery = queryDraft.trim();
    setFilters((prev) => ({ ...prev, query: nextQuery, page: 1 }));
  }, [queryDraft]);

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({ ...INITIAL_FILTERS, pageSize: prev.pageSize }));
    setQueryDraft('');
    setSnapshot(null);
    setMeta(null);
  }, []);

  return (
    <main className="relative min-h-screen bg-[#f5f8ff] pb-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(15,118,110,0.14),transparent_40%),radial-gradient(circle_at_88%_8%,rgba(37,99,235,0.15),transparent_36%)]" />
      {loading && (
        <div className="sticky top-0 z-40 h-1 w-full overflow-hidden bg-blue-100/80">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-teal-600 to-blue-600" />
        </div>
      )}

      <div className="relative mx-auto flex w-full max-w-[1340px] flex-col gap-5 px-4 py-5 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-slate-300 bg-white p-1 shadow-sm">
            <Link href={`/?${buildQueryParams(filters).toString()}`} className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              Overview
            </Link>
            <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">Analysis</span>
          </div>
          <p className="text-xs text-slate-500">
            {loadingStatusText || (meta ? `${meta.cached ? 'cache hit' : 'fresh query'} · ${meta.queryMs}ms` : 'Awaiting analysis data')}
          </p>
        </div>

        <section className="overflow-hidden rounded-3xl border border-sky-200 bg-white/95 p-5 shadow-xl shadow-blue-100/70">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">MEMA Consultants</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 md:text-[2.5rem]">Deep Analysis Workspace</h1>
              <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
                Drill into year, firm, product, precedent, and root-cause patterns across the FOS corpus with cross-filtered analytics.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              {meta?.snapshotAt ? `Snapshot ${formatDateTime(meta.snapshotAt)}` : 'Snapshot timestamp unavailable'}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <label className="block text-xs uppercase tracking-[0.16em] text-slate-500">Global case search</label>
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearchQuery();
              }}
              placeholder="Case reference, product, firm, rule, reasoning..."
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
              {loading && loadingProgressPct != null && (
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs text-blue-700">
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-blue-100">
                    <span className="block h-full bg-blue-500" style={{ width: `${loadingProgressPct}%` }} />
                  </span>
                  {loadingProgressPct}%
                </span>
              )}
              {!loading && lastLoadMs != null && <span className="text-xs text-slate-500">Last refresh {(lastLoadMs / 1000).toFixed(1)}s</span>}
            </div>
            {loading && !hasActiveFilters && (
              <p className="mt-2 text-xs text-slate-500">Refreshing full-corpus analysis after clearing filters…</p>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Year filters</p>
            <div className="flex flex-wrap gap-2">
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => toggleYear(year)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    filters.years.includes(year) ? 'border-teal-300 bg-teal-100 text-teal-800' : 'border-slate-300 bg-white text-slate-700 hover:border-teal-200'
                  }`}
                >
                  {year}
                </button>
              ))}
              {!availableYears.length && <span className="text-xs text-slate-500">No years under current filters.</span>}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Product filters</p>
            <div className="flex flex-wrap gap-2">
              {topProducts.slice(0, 10).map((product) => (
                <button
                  key={product}
                  onClick={() => toggleProduct(product)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    filters.products.includes(product)
                      ? 'border-blue-300 bg-blue-100 text-blue-800'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-blue-200'
                  }`}
                >
                  {product}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap gap-2">
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
        </section>

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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Decisions in scope" value={formatNumber(totalCases)} helper="Filtered corpus volume." accent="bg-blue-400" />
          <MetricCard
            label="Upheld rate"
            value={totalCases ? formatPercent((upheldCases / totalCases) * 100) : '0.0%'}
            helper={`${formatNumber(upheldCases)} upheld`}
            accent="bg-emerald-400"
          />
          <MetricCard
            label="Not upheld rate"
            value={totalCases ? formatPercent((notUpheldCases / totalCases) * 100) : '0.0%'}
            helper={`${formatNumber(notUpheldCases)} not upheld`}
            accent="bg-rose-400"
          />
          <MetricCard
            label="Firm rows benchmarked"
            value={formatNumber(snapshot?.firmBenchmark.length || 0)}
            helper="Volume vs adjudication performance."
            accent="bg-cyan-400"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr] xl:items-start">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Year over year adjudication trend</h2>
            <p className="mt-1 text-sm text-slate-500">Click a year to include or remove it from the full analysis scope.</p>
            <div className="mt-4 max-h-[460px] space-y-3 overflow-y-auto pr-1">
              {yearRollup.map((row, index) => {
                const previous = yearRollup[index - 1];
                const delta = previous ? row.total - previous.total : null;
                const barWidth = (row.total / yearMaxTotal) * 100;
                const upheldShare = row.total ? (row.upheld / row.total) * 100 : 0;
                const notShare = row.total ? (row.notUpheld / row.total) * 100 : 0;
                const partialShare = Math.max(0, 100 - upheldShare - notShare);
                const active = filters.years.includes(row.year);
                return (
                  <button
                    key={row.year}
                    onClick={() => toggleYear(row.year)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active ? 'border-teal-300 bg-teal-50' : 'border-slate-200 hover:border-teal-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {row.year} <span className="text-xs font-normal text-slate-500">{row.topProduct ? `top product: ${row.topProduct}` : ''}</span>
                      </p>
                      <p className="text-xs text-slate-600">
                        {formatNumber(row.total)} cases {delta != null ? `(${delta > 0 ? '+' : ''}${formatNumber(delta)} vs prior)` : '(baseline)'}
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-500" style={{ width: `${barWidth}%` }} />
                    </div>
                    <div className="mt-1.5 flex h-2 overflow-hidden rounded-full border border-slate-200">
                      <span className="bg-emerald-500" style={{ width: `${upheldShare}%` }} />
                      <span className="bg-rose-500" style={{ width: `${notShare}%` }} />
                      <span className="bg-indigo-400" style={{ width: `${partialShare}%` }} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span>Upheld {formatPercent(upheldShare)}</span>
                      <span>Not upheld {formatPercent(notShare)}</span>
                    </div>
                  </button>
                );
              })}
              {!yearRollup.length && <EmptyState label={loading ? 'Loading yearly trend...' : 'No yearly trend for current filters.'} />}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Year x product upheld-rate heatmap</h2>
            <p className="mt-1 text-sm text-slate-500">Click any cell to combine year and product filters.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-2 py-2">Year</th>
                    {heatmapProducts.map((product) => (
                      <th key={`hm-product-${product}`} className="px-2 py-2 text-center">
                        <button
                          onClick={() => toggleProduct(product)}
                          className={`rounded-full border px-2 py-1 text-[11px] ${
                            filters.products.includes(product) ? 'border-blue-300 bg-blue-100 text-blue-800' : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {truncate(product, 18)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapYears.map((year) => (
                    <tr key={`hm-year-${year}`} className="border-t border-slate-100">
                      <td className="px-2 py-2">
                        <button
                          onClick={() => toggleYear(year)}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            filters.years.includes(year) ? 'border-teal-300 bg-teal-100 text-teal-800' : 'border-slate-200 text-slate-700'
                          }`}
                        >
                          {year}
                        </button>
                      </td>
                      {heatmapProducts.map((product) => {
                        const key = `${year}::${product}`;
                        const cell = heatmapLookup.get(key);
                        const intensity = cell ? clamp(Math.round((cell.upheldRate / 100) * 100), 0, 100) : 0;
                        return (
                          <td key={key} className="px-2 py-2 text-center">
                            <button
                              onClick={() => {
                                toggleYear(year);
                                toggleProduct(product);
                              }}
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-blue-300"
                              style={{ backgroundColor: cell ? `rgba(14,165,233,${Math.max(0.12, intensity / 140)})` : undefined }}
                            >
                              {cell ? `${cell.upheldRate.toFixed(1)}%` : '--'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!heatmapYears.length && <EmptyState label="No heatmap values under current filters." />}
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Product upheld-rate leaderboard</p>
              <div className="mt-2 space-y-2">
                {productUpholdLeaderboard.map((item) => {
                  const width = clamp(Math.round((item.upheldRate / 100) * 100), 0, 100);
                  return (
                    <button
                      key={`leader-${item.product}`}
                      onClick={() => toggleProduct(item.product)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        filters.products.includes(item.product)
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="line-clamp-1 text-xs font-medium text-slate-800">{item.product}</span>
                        <span className="text-xs text-slate-600">
                          {formatPercent(item.upheldRate)} | {formatNumber(item.total)} cases
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${width}%` }} />
                      </div>
                    </button>
                  );
                })}
                {!productUpholdLeaderboard.length && <EmptyState label="No product leaderboard under this scope." />}
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr] xl:items-start">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Firm benchmark: volume vs upheld rate</h2>
            <p className="mt-1 text-sm text-slate-500">Use this to compare firm scale against adjudication outcomes.</p>
            <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {(snapshot?.firmBenchmark || []).slice(0, 40).map((firm) => {
                const width = (firm.total / firmBenchmarkMax) * 100;
                const active = filters.firms.includes(firm.firm);
                return (
                  <button
                    key={`benchmark-${firm.firm}`}
                    onClick={() => toggleFirm(firm.firm)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-medium text-slate-900">{firm.firm}</p>
                      <span className="text-xs text-slate-600">
                        {formatNumber(firm.total)} | upheld {formatPercent(firm.upheldRate)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${width}%` }} />
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500">
                      Dominant product: {firm.predominantProduct || 'n/a'} {firm.avgDecisionYear ? `| avg year ${firm.avgDecisionYear}` : ''}
                    </div>
                  </button>
                );
              })}
              {(snapshot?.firmBenchmark || []).length === 0 && <EmptyState label="No firm benchmark data under current filters." />}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Precedent x root-cause matrix</h2>
            <p className="mt-1 text-sm text-slate-500">Click row/column chips to filter by precedent or root cause tags.</p>
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                {matrixPrecedents.map((precedent) => (
                  <button
                    key={`prec-chip-${precedent}`}
                    onClick={() => toggleTag(precedent)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      filters.tags.includes(precedent) ? 'border-indigo-300 bg-indigo-100 text-indigo-800' : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    {precedent}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {matrixRootCauses.map((rootCause) => (
                  <button
                    key={`root-chip-${rootCause}`}
                    onClick={() => toggleTag(rootCause)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      filters.tags.includes(rootCause) ? 'border-cyan-300 bg-cyan-100 text-cyan-800' : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    {rootCause}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                      <th className="px-2 py-2">Precedent \ Root cause</th>
                      {matrixRootCauses.map((rootCause) => (
                        <th key={`rc-header-${rootCause}`} className="px-2 py-2 text-center">
                          {truncate(rootCause, 18)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixPrecedents.map((precedent) => (
                      <tr key={`matrix-row-${precedent}`} className="border-t border-slate-100">
                        <td className="px-2 py-2 text-xs text-slate-700">{precedent}</td>
                        {matrixRootCauses.map((rootCause) => {
                          const key = `${precedent}::${rootCause}`;
                          const count = matrixLookup.get(key) || 0;
                          const intensity = Math.max(0.08, count / matrixMax);
                          return (
                            <td key={key} className="px-2 py-2 text-center">
                              <button
                                onClick={() => toggleTag(precedent)}
                                className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-700"
                                style={{ backgroundColor: count > 0 ? `rgba(59,130,246,${intensity})` : undefined }}
                              >
                                {count || '--'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!matrixPrecedents.length && <EmptyState label="No precedent/root-cause matrix under this scope." />}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr] xl:items-start">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Product to firm distribution</h2>
            <p className="mt-1 text-sm text-slate-500">High-volume products with their top firms and upheld-rate quality signal.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(snapshot?.productTree || []).slice(0, 8).map((productNode) => (
                <div key={`product-tree-${productNode.product}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <button
                    onClick={() => toggleProduct(productNode.product)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      filters.products.includes(productNode.product) ? 'border-blue-300 bg-blue-100 text-blue-800' : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    {productNode.product}
                  </button>
                  <p className="mt-2 text-xs text-slate-600">{formatNumber(productNode.total)} decisions in this product scope.</p>
                  <div className="mt-2 space-y-1.5">
                    {productNode.firms.slice(0, 4).map((firmNode) => {
                      const share = productNode.total ? (firmNode.total / productNode.total) * 100 : 0;
                      return (
                        <button
                          key={`node-${productNode.product}-${firmNode.firm}`}
                          onClick={() => toggleFirm(firmNode.firm)}
                          className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                            filters.firms.includes(firmNode.firm)
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-slate-200 bg-white hover:border-blue-200'
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="line-clamp-1 text-xs font-medium text-slate-800">{firmNode.firm}</span>
                            <span className="text-[11px] text-slate-600">{share.toFixed(1)}%</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${share}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {(snapshot?.productTree || []).length === 0 && <EmptyState label="No product tree data under current filters." />}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Yearly analysis narratives</h2>
            <p className="mt-1 text-sm text-slate-500">Auto-generated commentary from year-level volumes, rates, and concentration points.</p>
            <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {(snapshot?.yearNarratives || []).map((item) => (
                <article key={`narrative-${item.year}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{item.headline}</h3>
                    <button
                      onClick={() => toggleYear(item.year)}
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                        filters.years.includes(item.year) ? 'border-teal-300 bg-teal-100 text-teal-800' : 'border-slate-300 text-slate-600'
                      }`}
                    >
                      {item.year}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">{item.detail}</p>
                </article>
              ))}
              {(snapshot?.yearNarratives || []).length === 0 && <EmptyState label="No narrative insights for this filter combination." />}
            </div>
          </article>
        </section>

        {!loading && !error && snapshot && totalCases === 0 && hasActiveFilters && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No results for current filters. Clear one or more chips to widen scope.
          </section>
        )}
      </div>
    </main>
  );
}

function MetricCard({ label, value, helper, accent }: { label: string; value: string; helper: string; accent: string }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 ${accent}`} />
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button onClick={onClear} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-slate-400">
      {label} x
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
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
