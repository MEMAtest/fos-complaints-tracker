import { NextRequest } from 'next/server';
import { getAnalysisSnapshot, parseFilters } from '@/lib/fos/repository';
import { FOSAnalysisApiResponse } from '@/types/fos-dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 50;
const cache = new Map<string, { expiresAt: number; payload: FOSAnalysisApiResponse }>();
const RESPONSE_HEADERS = { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' };

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
        } satisfies FOSAnalysisApiResponse,
        { headers: RESPONSE_HEADERS }
      );
    }

    const filters = parseFilters(request.nextUrl.searchParams);
    const snapshot = await getAnalysisSnapshot(filters);
    const snapshotAt = new Date().toISOString();

    const payload: FOSAnalysisApiResponse = {
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
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return Response.json(payload, { headers: RESPONSE_HEADERS });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analysis data.',
      },
      { status: 500 }
    );
  }
}
