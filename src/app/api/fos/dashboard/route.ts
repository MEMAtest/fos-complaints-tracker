import { NextRequest } from 'next/server';
import { getDashboardSnapshot, parseFilters } from '@/lib/fos/repository';
import { FOSDashboardApiResponse } from '@/types/fos-dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { expiresAt: number; payload: FOSDashboardApiResponse }>();
const RESPONSE_HEADERS = { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' };

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
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
        { headers: RESPONSE_HEADERS }
      );
    }

    const filters = parseFilters(request.nextUrl.searchParams);
    const includeCases = request.nextUrl.searchParams.get('includeCases') !== 'false';
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
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return Response.json(payload, { headers: RESPONSE_HEADERS });
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
