'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FOSDashboardFilters, FOSOutcome } from '@/lib/fos/types';
import { INITIAL_FILTERS } from '@/lib/fos/constants';
import { clamp, parsePositiveInt, toggleNumber, toggleText } from '@/lib/utils';

function parseFiltersFromQueryString(search: string): FOSDashboardFilters {
  const params = new URLSearchParams(search);
  const parseStringList = (key: string): string[] =>
    Array.from(
      new Set(
        params.getAll(key).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
      )
    );

  const parseNumberList = (key: string): number[] =>
    parseStringList(key)
      .map((v) => Number.parseInt(v, 10))
      .filter((v) => Number.isInteger(v))
      .sort((a, b) => a - b);

  const outcomes = parseStringList('outcome').filter((v): v is FOSOutcome =>
    ['upheld', 'not_upheld', 'partially_upheld', 'settled', 'not_settled', 'unknown'].includes(v)
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

export function buildQueryParams(filters: FOSDashboardFilters): URLSearchParams {
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

export function useFosFilters() {
  const [filters, setFilters] = useState<FOSDashboardFilters>(INITIAL_FILTERS);
  const [queryDraft, setQueryDraft] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const parsed = parseFiltersFromQueryString(window.location.search);
    setFilters(parsed);
    setQueryDraft(parsed.query);
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const params = buildQueryParams(filters);
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }, [filters, initialized]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(filters.query) ||
      filters.years.length > 0 ||
      filters.outcomes.length > 0 ||
      filters.products.length > 0 ||
      filters.firms.length > 0 ||
      filters.tags.length > 0,
    [filters]
  );

  const toggleYear = useCallback((year: number) => {
    setFilters((prev) => ({ ...prev, years: toggleNumber(prev.years, year), page: 1 }));
  }, []);

  const toggleOutcome = useCallback((outcome: FOSOutcome) => {
    setFilters((prev) => ({ ...prev, outcomes: toggleText(prev.outcomes, outcome), page: 1 }));
  }, []);

  const toggleProduct = useCallback((product: string) => {
    setFilters((prev) => ({
      ...prev,
      products: prev.products.includes(product) ? [] : [product],
      page: 1,
    }));
  }, []);

  const toggleFirm = useCallback((firm: string) => {
    setFilters((prev) => ({
      ...prev,
      firms: prev.firms.includes(firm) ? [] : [firm],
      page: 1,
    }));
  }, []);

  const setTagFilter = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? [] : [tag],
      page: 1,
    }));
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      page: 1,
    }));
  }, []);

  const setYears = useCallback((years: number[]) => {
    setFilters((prev) => ({ ...prev, years, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const applySearchQuery = useCallback(() => {
    const nextQuery = queryDraft.trim();
    setFilters((prev) => (prev.query === nextQuery ? prev : { ...prev, query: nextQuery, page: 1 }));
  }, [queryDraft]);

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({ ...INITIAL_FILTERS, pageSize: prev.pageSize }));
    setQueryDraft('');
  }, []);

  return {
    filters,
    setFilters,
    queryDraft,
    setQueryDraft,
    initialized,
    hasActiveFilters,
    toggleYear,
    toggleOutcome,
    toggleProduct,
    toggleFirm,
    setTagFilter,
    toggleTag,
    setYears,
    setPage,
    applySearchQuery,
    clearFilters,
  };
}
