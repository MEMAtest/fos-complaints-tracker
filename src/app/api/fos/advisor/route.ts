import { NextRequest } from 'next/server';
import { getAdvisorBrief } from '@/lib/fos/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 30;
const cache = new Map<string, { expiresAt: number; payload: unknown }>();

function pruneCache() {
  const now = Date.now();
  const expired: string[] = [];
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) expired.push(key);
  }
  for (const key of expired) cache.delete(key);
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = Array.from(cache.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < oldest.length - MAX_CACHE_ENTRIES; i++) cache.delete(oldest[i][0]);
  }
}

export async function GET(request: NextRequest) {
  try {
    pruneCache();

    const params = request.nextUrl.searchParams;
    const product = params.get('product')?.trim();
    if (!product) {
      return Response.json({ success: false, error: 'product parameter is required' }, { status: 400 });
    }
    if (product.length > 200) {
      return Response.json({ success: false, error: 'product parameter too long' }, { status: 400 });
    }

    const rootCause = params.get('rootCause')?.trim() || null;
    if (rootCause && rootCause.length > 200) {
      return Response.json({ success: false, error: 'rootCause parameter too long' }, { status: 400 });
    }
    const freeText = params.get('freeText')?.trim() || null;
    if (freeText && freeText.length > 5000) {
      return Response.json({ success: false, error: 'freeText parameter too long' }, { status: 400 });
    }

    // Only cache when no free text (pre-computed data is stable)
    const cacheKey = `${product}::${rootCause || ''}`;
    if (!freeText) {
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return Response.json(cached.payload, {
          headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' },
        });
      }
    }

    const brief = await getAdvisorBrief({ product, rootCause, freeText });

    if (!brief) {
      return Response.json(
        { success: false, error: `No intelligence brief available for "${product}"${rootCause ? ` + "${rootCause}"` : ''}.` },
        { status: 404 }
      );
    }

    const payload = { success: true, data: brief };

    if (!freeText) {
      cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    }

    return Response.json(payload, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' },
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch advisor brief.' },
      { status: 500 }
    );
  }
}
