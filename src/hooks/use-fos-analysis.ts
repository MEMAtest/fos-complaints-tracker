'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FOSAnalysisSnapshot,
  FOSCaseListItem,
  FOSDashboardFilters,
  FOSPagination,
  FOSSubsetAnalysis,
} from '@/lib/fos/types';
import { FOSAnalysisApiResponse, FOSApiMeta, FOSCasesApiResponse, FOSSynthesisApiResponse } from '@/types/fos-dashboard';
import { ANALYSIS_TIMEOUT_MS } from '@/lib/fos/constants';
import { buildQueryParams } from './use-fos-filters';
import { useLoadingProgress } from './use-loading-progress';

export function useFosAnalysis(filters: FOSDashboardFilters, initialized: boolean) {
  const [snapshot, setSnapshot] = useState<FOSAnalysisSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<FOSApiMeta | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const progress = useLoadingProgress(loading);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const fetchAnalysis = useCallback(async (nextFilters: FOSDashboardFilters) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort(); }, ANALYSIS_TIMEOUT_MS);
    const startedAt = Date.now();

    setLoading(true);
    setError(null);
    progressRef.current.startTracking();

    try {
      const response = await fetch(`/api/fos/analysis?${buildQueryParams(nextFilters).toString()}`, { signal: controller.signal });
      let payload: FOSAnalysisApiResponse | null = null;
      try { payload = (await response.json()) as FOSAnalysisApiResponse; } catch { payload = null; }

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || `Analysis request failed (${response.status}).`);
      }

      progressRef.current.recordDuration(Date.now() - startedAt);
      setSnapshot(payload.data);
      setMeta(payload.meta || null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (timedOut) setError(`Analysis query timed out after ${Math.round(ANALYSIS_TIMEOUT_MS / 1000)}s. Retry with fewer filters.`);
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown analysis error.');
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
    void fetchAnalysis(filters);
  }, [fetchAnalysis, filters, initialized]);

  useEffect(() => () => { requestRef.current?.abort(); }, []);

  return { snapshot, loading, error, meta, progress, fetchAnalysis };
}

// ─── Subset cases hook ──────────────────────────────────────────────────────

export function useSubsetCases() {
  const [cases, setCases] = useState<FOSCaseListItem[]>([]);
  const [pagination, setPagination] = useState<FOSPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchSubsetCases = useCallback(async (filters: FOSDashboardFilters, page: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = buildQueryParams({ ...filters, page, pageSize: 25 });
      const response = await fetch(`/api/fos/analysis/cases?${params.toString()}`, { signal: controller.signal });
      const payload = (await response.json()) as FOSCasesApiResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || `Cases request failed (${response.status}).`);
      }

      setCases(payload.data.items);
      setPagination(payload.data.pagination);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load cases.');
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setCases([]);
    setPagination(null);
    setError(null);
  }, []);

  useEffect(() => () => { controllerRef.current?.abort(); }, []);

  return { cases, pagination, loading, error, fetchSubsetCases, reset };
}

// ─── Synthesis hook ─────────────────────────────────────────────────────────

export function useSubsetSynthesis() {
  const [synthesis, setSynthesis] = useState<FOSSubsetAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchSynthesis = useCallback(async (filters: FOSDashboardFilters) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    setSynthesis(null);

    try {
      const response = await fetch('/api/fos/analysis/synthesise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as FOSSynthesisApiResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || `Synthesis request failed (${response.status}).`);
      }

      setSynthesis(payload.data);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to generate analysis.');
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setSynthesis(null);
    setError(null);
  }, []);

  useEffect(() => () => { controllerRef.current?.abort(); }, []);

  return { synthesis, loading, error, fetchSynthesis, reset };
}
