'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FOSAnalysisSnapshot, FOSDashboardFilters } from '@/lib/fos/types';
import { FOSAnalysisApiResponse, FOSApiMeta } from '@/types/fos-dashboard';
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
