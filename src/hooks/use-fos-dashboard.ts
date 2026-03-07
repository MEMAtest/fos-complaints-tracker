'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FOSCaseDetail, FOSDashboardFilters, FOSDashboardSnapshot } from '@/lib/fos/types';
import { FOSApiMeta, FOSCaseDetailApiResponse, FOSDashboardApiResponse } from '@/types/fos-dashboard';
import { DASHBOARD_TIMEOUT_MS } from '@/lib/fos/constants';
import { buildQueryParams } from './use-fos-filters';
import { useLoadingProgress } from './use-loading-progress';

type ProgressRef = { startTracking: () => void; recordDuration: (ms: number) => void; stopTracking: () => void };

type FOSCaseListApiResponse = {
  success: boolean;
  data?: {
    cases: FOSDashboardSnapshot['cases'];
    pagination: FOSDashboardSnapshot['pagination'];
  };
  error?: string;
};

type FOSCaseListData = {
  cases: FOSDashboardSnapshot['cases'];
  pagination: FOSDashboardSnapshot['pagination'];
};

export function useFosDashboard(filters: FOSDashboardFilters, initialized: boolean) {
  const [snapshot, setSnapshot] = useState<FOSDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [responseMeta, setResponseMeta] = useState<FOSApiMeta | null>(null);
  const dashboardRequestRef = useRef<AbortController | null>(null);
  const casesRequestRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);
  const renderedRequestIdRef = useRef(0);
  const pendingCaseBundleRef = useRef<FOSCaseListData | null>(null);
  const progress = useLoadingProgress(loading);
  const progressRef = useRef<ProgressRef>(progress);
  progressRef.current = progress;

  const loadCaseRows = useCallback(async (nextFilters: FOSDashboardFilters) => {
    casesRequestRef.current?.abort();
    const controller = new AbortController();
    casesRequestRef.current = controller;
    setCasesLoading(true);
    setCasesError(null);

    try {
      const params = buildQueryParams(nextFilters);
      const response = await fetch(`/api/fos/cases?${params.toString()}`, { signal: controller.signal });
      let payload: FOSCaseListApiResponse | null = null;
      try { payload = (await response.json()) as FOSCaseListApiResponse; } catch { payload = null; }

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || `Case list request failed (${response.status}).`);
      }

      return payload.data;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setCasesError(err instanceof Error ? err.message : 'Unable to load case rows.');
      return null;
    } finally {
      if (casesRequestRef.current === controller) {
        casesRequestRef.current = null;
        setCasesLoading(false);
      }
    }
  }, []);

  const fetchCaseRows = useCallback(async (nextFilters: FOSDashboardFilters) => {
    const data = await loadCaseRows(nextFilters);
    if (!data) return;

    setSnapshot((prev) =>
      prev ? { ...prev, cases: data.cases || [], pagination: data.pagination || prev.pagination } : prev
    );
  }, [loadCaseRows]);

  const fetchDashboard = useCallback(async (nextFilters: FOSDashboardFilters) => {
    dashboardRequestRef.current?.abort();
    const controller = new AbortController();
    dashboardRequestRef.current = controller;
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    renderedRequestIdRef.current = 0;
    pendingCaseBundleRef.current = null;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort(); }, DASHBOARD_TIMEOUT_MS);
    const startedAt = Date.now();

    setLoading(true);
    setError(null);
    setCasesError(null);
    progressRef.current.startTracking();

    try {
      const caseRowsPromise = loadCaseRows(nextFilters).then((data) => {
        if (!data || requestSequenceRef.current !== requestId) return null;

        pendingCaseBundleRef.current = data;
        if (renderedRequestIdRef.current !== requestId) {
          return data;
        }

        setSnapshot((prev) =>
          prev ? { ...prev, cases: data.cases || [], pagination: data.pagination || prev.pagination } : prev
        );
        pendingCaseBundleRef.current = null;
        return data;
      });

      const params = buildQueryParams(nextFilters);
      params.set('includeCases', 'false');
      const response = await fetch(`/api/fos/dashboard?${params.toString()}`, { signal: controller.signal });
      let payload: FOSDashboardApiResponse | null = null;
      try { payload = (await response.json()) as FOSDashboardApiResponse; } catch { payload = null; }

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || `Dashboard request failed (${response.status}).`);
      }

      progressRef.current.recordDuration(Date.now() - startedAt);
      renderedRequestIdRef.current = requestId;
      const caseBundle =
        (pendingCaseBundleRef.current as FOSCaseListData | null) || {
          cases: [] as FOSDashboardSnapshot['cases'],
          pagination: payload.data.pagination,
        };
      pendingCaseBundleRef.current = null;
      setSnapshot({
        ...payload.data,
        cases: caseBundle.cases,
        pagination: caseBundle.pagination,
      });
      setResponseMeta(payload.meta || null);
      void caseRowsPromise;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (timedOut) setError(`Dashboard query timed out after ${Math.round(DASHBOARD_TIMEOUT_MS / 1000)}s. Please retry.`);
        return;
      }
      pendingCaseBundleRef.current = null;
      setError(err instanceof Error ? err.message : 'Unknown dashboard error');
    } finally {
      window.clearTimeout(timeoutId);
      if (dashboardRequestRef.current === controller) {
        dashboardRequestRef.current = null;
        setLoading(false);
        progressRef.current.stopTracking();
      }
    }
  }, [loadCaseRows]);

  useEffect(() => {
    if (!initialized) return;
    void fetchDashboard(filters);
  }, [fetchDashboard, filters, initialized]);

  useEffect(() => () => {
    dashboardRequestRef.current?.abort();
    casesRequestRef.current?.abort();
  }, []);

  return {
    snapshot,
    loading,
    error,
    casesLoading,
    casesError,
    responseMeta,
    progress,
    fetchDashboard,
    fetchCaseRows,
  };
}

export function useCaseDetail() {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<FOSCaseDetail | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);

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
      } catch (err) {
        if (!cancelled) setCaseError(err instanceof Error ? err.message : 'Unknown case detail error');
      } finally {
        if (!cancelled) setCaseLoading(false);
      }
    };

    void loadCase();
    return () => { cancelled = true; };
  }, [selectedCaseId]);

  return { selectedCaseId, setSelectedCaseId, selectedCase, caseLoading, caseError };
}
