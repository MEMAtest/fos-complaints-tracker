'use client';

import { useEffect, useMemo, useState } from 'react';
import { clamp } from '@/lib/utils';

export function useLoadingProgress(loading: boolean) {
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const [loadingElapsedSec, setLoadingElapsedSec] = useState(0);
  const [averageLoadMs, setAverageLoadMs] = useState<number | null>(null);
  const [lastLoadMs, setLastLoadMs] = useState<number | null>(null);

  const startTracking = () => {
    setRequestStartedAt(Date.now());
    setLoadingElapsedSec(0);
  };

  const recordDuration = (durationMs: number) => {
    setLastLoadMs(durationMs);
    setAverageLoadMs((prev) => (prev == null ? durationMs : Math.round(prev * 0.7 + durationMs * 0.3)));
  };

  const stopTracking = () => {
    setRequestStartedAt(null);
  };

  useEffect(() => {
    if (!loading || requestStartedAt == null) return;
    const tick = () => setLoadingElapsedSec(Math.max(0, Math.floor((Date.now() - requestStartedAt) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [loading, requestStartedAt]);

  const estimatedRemainingSec = useMemo(() => {
    if (!loading || averageLoadMs == null) return null;
    return Math.max(0, Math.ceil((averageLoadMs - loadingElapsedSec * 1000) / 1000));
  }, [averageLoadMs, loading, loadingElapsedSec]);

  const loadingProgressPct = useMemo(() => {
    if (!loading || averageLoadMs == null || averageLoadMs <= 0) return null;
    return clamp(Math.round((loadingElapsedSec * 1000 * 100) / averageLoadMs), 5, 95);
  }, [averageLoadMs, loading, loadingElapsedSec]);

  return {
    loadingElapsedSec,
    averageLoadMs,
    lastLoadMs,
    estimatedRemainingSec,
    loadingProgressPct,
    startTracking,
    recordDuration,
    stopTracking,
  };
}
