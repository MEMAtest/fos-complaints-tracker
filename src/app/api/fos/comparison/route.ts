import { NextRequest } from 'next/server';
import { parseFilters, getComparisonSnapshot } from '@/lib/fos/repository';
import { FOSComparisonSnapshot, FOSDashboardFilters } from '@/lib/fos/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ComparisonApiResponse {
  success: boolean;
  data?: FOSComparisonSnapshot;
  generatedAt?: string;
  filters?: FOSDashboardFilters;
  meta?: { cached: boolean; queryMs: number; snapshotAt?: string };
  error?: string;
}

const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 50;
const MAX_FIRM_NAME_LENGTH = 200;
const cache = new Map<string, { expiresAt: number; payload: ComparisonApiResponse }>();
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
    const firmA = request.nextUrl.searchParams.get('firmA');
    const firmB = request.nextUrl.searchParams.get('firmB');

    if (!firmA || !firmB) {
      return Response.json(
        {
          success: false,
          error: 'Both firmA and firmB query parameters are required.',
        } satisfies ComparisonApiResponse,
        { status: 400 }
      );
    }

    if (firmA.length > MAX_FIRM_NAME_LENGTH || firmB.length > MAX_FIRM_NAME_LENGTH) {
      return Response.json(
        {
          success: false,
          error: `Firm name must be ${MAX_FIRM_NAME_LENGTH} characters or fewer.`,
        } satisfies ComparisonApiResponse,
        { status: 400 }
      );
    }

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
        } satisfies ComparisonApiResponse,
        { headers: RESPONSE_HEADERS }
      );
    }

    const filters = parseFilters(request.nextUrl.searchParams);
    const snapshot = await getComparisonSnapshot(firmA, firmB, filters);
    const snapshotAt = new Date().toISOString();

    const payload: ComparisonApiResponse = {
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
        error: error instanceof Error ? error.message : 'Failed to fetch comparison data.',
      },
      { status: 500 }
    );
  }
}
