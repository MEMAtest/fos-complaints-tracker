'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FOSAdvisorBrief } from '@/lib/fos/types';
import type { FOSAdvisorApiResponse, FOSAdvisorOptionsApiResponse } from '@/types/fos-dashboard';
import type { EstimatorFirmOverlay } from '@/lib/fos/advisor-repository';

const ESTIMATOR_TIMEOUT_MS = 30_000;

interface FirmOverlayApiResponse {
  success: boolean;
  data?: EstimatorFirmOverlay | null;
  error?: string;
}

export function useCheckEstimator() {
  const [brief, setBrief] = useState<FOSAdvisorBrief | null>(null);
  const [firmOverlay, setFirmOverlay] = useState<EstimatorFirmOverlay | null>(null);
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
      console.error('Failed to load estimator options:', err);
      setOptions({ products: [], rootCauses: [] });
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const fetchEstimate = useCallback(async (product: string, rootCause?: string, firm?: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ESTIMATOR_TIMEOUT_MS);

    setLoading(true);
    setError(null);
    setBrief(null);
    setFirmOverlay(null);

    try {
      const advisorParams = new URLSearchParams({ product });
      if (rootCause) advisorParams.set('rootCause', rootCause);

      const advisorPromise = fetch(`/api/fos/advisor?${advisorParams.toString()}`, {
        signal: controller.signal,
      });

      let firmPromise: Promise<Response> | null = null;
      if (firm) {
        const firmParams = new URLSearchParams({ product, firm });
        if (rootCause) firmParams.set('rootCause', rootCause);
        firmPromise = fetch(`/api/fos/check/firm-overlay?${firmParams.toString()}`, {
          signal: controller.signal,
        });
      }

      const [advisorRes, firmRes] = await Promise.all([
        advisorPromise,
        firmPromise ?? Promise.resolve(null),
      ]);

      // Parse advisor brief
      let advisorPayload: FOSAdvisorApiResponse | null = null;
      try {
        advisorPayload = (await advisorRes.json()) as FOSAdvisorApiResponse;
      } catch {
        advisorPayload = null;
      }

      if (!advisorRes.ok || !advisorPayload?.success || !advisorPayload.data) {
        if (advisorRes.status === 404) {
          setError('Not enough historical data for this combination. Try selecting just the product.');
          return;
        }
        throw new Error(
          advisorRes.status >= 500
            ? 'Service temporarily unavailable. Please try again.'
            : 'Unable to load estimate. Please check your selections.'
        );
      }

      setBrief(advisorPayload.data);

      // Parse firm overlay if requested
      if (firmRes) {
        let firmPayload: FirmOverlayApiResponse | null = null;
        try {
          firmPayload = (await firmRes.json()) as FirmOverlayApiResponse;
        } catch {
          firmPayload = null;
        }

        if (firmRes.ok && firmPayload?.success && firmPayload.data) {
          setFirmOverlay(firmPayload.data);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (timedOut) setError(`Request timed out after ${Math.round(ESTIMATOR_TIMEOUT_MS / 1000)}s.`);
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
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

  return { brief, firmOverlay, loading, error, options, optionsLoading, fetchEstimate, fetchOptions };
}
