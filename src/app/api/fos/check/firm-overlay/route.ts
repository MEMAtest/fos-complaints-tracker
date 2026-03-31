import { NextRequest } from 'next/server';
import { getEstimatorFirmOverlay } from '@/lib/fos/advisor-repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 30;
const cache = new Map<string, { expiresAt: number; payload: unknown }>();

const UNSAFE_CHARS_RE = /[<>{}[\]\\;]/;

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
    if (product.length > 200 || UNSAFE_CHARS_RE.test(product)) {
      return Response.json({ success: false, error: 'Invalid product parameter' }, { status: 400 });
    }

    const firm = params.get('firm')?.trim();
    if (!firm) {
      return Response.json({ success: false, error: 'firm parameter is required' }, { status: 400 });
    }
    if (firm.length > 200 || UNSAFE_CHARS_RE.test(firm)) {
      return Response.json({ success: false, error: 'Invalid firm parameter' }, { status: 400 });
    }

    const rootCause = params.get('rootCause')?.trim() || null;
    if (rootCause && (rootCause.length > 200 || UNSAFE_CHARS_RE.test(rootCause))) {
      return Response.json({ success: false, error: 'Invalid rootCause parameter' }, { status: 400 });
    }

    const cacheKey = JSON.stringify([product, rootCause || null, firm]);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json(cached.payload, {
        headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' },
      });
    }

    const overlay = await getEstimatorFirmOverlay(product, rootCause, firm);

    const payload = overlay
      ? { success: true, data: overlay }
      : { success: true, data: null };

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });

    return Response.json(payload, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' },
    });
  } catch (error) {
    return Response.json(
      { success: false, error: 'Service temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
