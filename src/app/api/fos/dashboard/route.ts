import { NextRequest } from 'next/server';
import { getDashboardSnapshot, parseFilters } from '@/lib/fos/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { expiresAt: number; payload: unknown }>();

export async function GET(request: NextRequest) {
  try {
    const cacheKey = request.nextUrl.searchParams.toString();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json(cached.payload);
    }

    const filters = parseFilters(request.nextUrl.searchParams);
    const snapshot = await getDashboardSnapshot(filters);
    const payload = {
      success: true,
      generatedAt: new Date().toISOString(),
      filters,
      data: snapshot,
    };

    cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return Response.json(payload);
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
