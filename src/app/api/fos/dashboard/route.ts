import { NextRequest } from 'next/server';
import { getDashboardSnapshot, hasActiveScopeFilters, parseFilters } from '@/lib/fos/repository';
import { FOSDashboardApiResponse } from '@/types/fos-dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FILTERED_CACHE_TTL_MS = 30_000;
const UNFILTERED_CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 50;
const cache = new Map<string, { expiresAt: number; payload: FOSDashboardApiResponse }>();
const FILTERED_HEADERS = { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' };
const UNFILTERED_HEADERS = { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' };

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = Array.from(cache.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < oldest.length - MAX_CACHE_ENTRIES; i++) cache.delete(oldest[i][0]);
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    pruneCache();
    const filters = parseFilters(request.nextUrl.searchParams);
    const includeCases = request.nextUrl.searchParams.get('includeCases') !== 'false';
    const unfiltered = !hasActiveScopeFilters(filters);
    const headers = unfiltered ? UNFILTERED_HEADERS : FILTERED_HEADERS;
    const cacheTtlMs = unfiltered ? UNFILTERED_CACHE_TTL_MS : FILTERED_CACHE_TTL_MS;
    const cacheKey = request.nextUrl.searchParams.toString();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json(
        {
          ...cached.payload,
          generatedAt: new Date().toISOString(),
          meta: {
            cached: true,
            queryMs: Date.now() - startedAt,
            snapshotAt: cached.payload.meta?.snapshotAt || cached.payload.generatedAt,
          },
        } satisfies FOSDashboardApiResponse,
        { headers }
      );
    }

    const snapshot = await getDashboardSnapshot(filters, { includeCases });
    const snapshotAt = new Date().toISOString();
    const payload = {
      success: true,
      generatedAt: snapshotAt,
      filters,
      data: snapshot,
      meta: {
        cached: false,
        queryMs: Date.now() - startedAt,
        snapshotAt,
      },
    };

    cache.set(cacheKey, {
      expiresAt: Date.now() + cacheTtlMs,
      payload,
    });

    return Response.json(payload, { headers });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch FOS dashboard data.',
      },
      { status: 500 }
    );
  }
}
