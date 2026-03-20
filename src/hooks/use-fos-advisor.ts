'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FOSAdvisorBrief, FOSAdvisorQuery } from '@/lib/fos/types';
import { FOSAdvisorApiResponse, FOSAdvisorOptionsApiResponse } from '@/types/fos-dashboard';

const ADVISOR_TIMEOUT_MS = 30_000;

export function useFosAdvisor() {
  const [brief, setBrief] = useState<FOSAdvisorBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<{ products: string[]; rootCauses: string[] } | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const requestRef = useRef<AbortController | null>(null);

  const fetchOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const response = await fetch('/api/fos/advisor/options', { cache: 'no-store' });
      const payload = (await response.json()) as FOSAdvisorOptionsApiResponse;
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || `Options request failed (${response.status}).`);
      }
      setOptions(payload.data);
    } catch (err) {
      console.error('Failed to load advisor options:', err);
      setOptions({ products: [], rootCauses: [] });
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const fetchBrief = useCallback(async (query: FOSAdvisorQuery) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ADVISOR_TIMEOUT_MS);

    setLoading(true);
    setError(null);
    setBrief(null);

    try {
      const params = new URLSearchParams({ product: query.product });
      if (query.rootCause) params.set('rootCause', query.rootCause);
      if (query.freeText) params.set('freeText', query.freeText);

      const response = await fetch(`/api/fos/advisor?${params.toString()}`, { signal: controller.signal });
      let payload: FOSAdvisorApiResponse | null = null;
      try {
        payload = (await response.json()) as FOSAdvisorApiResponse;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || `Advisor request failed (${response.status}).`);
      }

      setBrief(payload.data);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (timedOut) setError(`Request timed out after ${Math.round(ADVISOR_TIMEOUT_MS / 1000)}s.`);
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown advisor error.');
    } finally {
      window.clearTimeout(timeoutId);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  useEffect(() => () => { requestRef.current?.abort(); }, []);

  return { brief, loading, error, options, optionsLoading, fetchBrief, fetchOptions };
}
