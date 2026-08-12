import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getAdvisorBrief } from '@/lib/fos/repository';
import type { FOSAdvisorBrief } from '@/lib/fos/types';
import type { FOSAdvisorApiResponse } from '@/types/fos-dashboard';

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
    if (params.has('freeText')) {
      return Response.json(
        { success: false, error: 'Complaint text must be submitted privately with POST.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const cacheKey = `${product}::${rootCause || ''}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json(cached.payload, {
        headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' },
      });
    }

    const brief = await getAdvisorBrief({ product, rootCause, freeText: null });

    if (!brief) {
      return Response.json(
        { success: false, error: `No intelligence brief available for "${product}"${rootCause ? ` + "${rootCause}"` : ''}.` },
        { status: 404 }
      );
    }

    const payload: FOSAdvisorApiResponse = { success: true, data: serializeAdvisorBrief(brief) };

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });

    return Response.json(payload, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' },
    });
  } catch {
    return Response.json(
      { success: false, error: 'Advisor evidence is temporarily unavailable. Please retry.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request, 'viewer');
    const body = await request.json().catch(() => null) as {
      product?: unknown;
      rootCause?: unknown;
      complaintText?: unknown;
    } | null;
    const product = typeof body?.product === 'string' ? body.product.trim() : '';
    const rootCause = typeof body?.rootCause === 'string' ? body.rootCause.trim() || null : null;
    const complaintText = typeof body?.complaintText === 'string' ? body.complaintText.trim() : '';

    if (!product) {
      return Response.json({ success: false, error: 'product is required' }, { status: 400, headers: privateHeaders() });
    }
    if (product.length > 200 || (rootCause && rootCause.length > 200)) {
      return Response.json({ success: false, error: 'Advisor selection is too long.' }, { status: 400, headers: privateHeaders() });
    }
    if (!complaintText) {
      return Response.json({ success: false, error: 'complaintText is required' }, { status: 400, headers: privateHeaders() });
    }
    if (complaintText.length > 5000) {
      return Response.json({ success: false, error: 'complaintText must be 5,000 characters or fewer.' }, { status: 400, headers: privateHeaders() });
    }

    const brief = await getAdvisorBrief({ product, rootCause, freeText: complaintText });
    if (!brief) {
      return Response.json(
        { success: false, error: `No intelligence brief is available for the selected scope.` },
        { status: 404, headers: privateHeaders() }
      );
    }

    const payload: FOSAdvisorApiResponse = { success: true, data: serializeAdvisorBrief(brief) };
    return Response.json(payload, { headers: privateHeaders() });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json(
      { success: false, error: status === 500 ? 'Private advisor analysis is temporarily unavailable.' : error instanceof Error ? error.message : 'Advisor request failed.' },
      { status, headers: privateHeaders() }
    );
  }
}

function privateHeaders() {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    Vary: 'Cookie',
  };
}

function serializeAdvisorBrief(brief: FOSAdvisorBrief): FOSAdvisorApiResponse['data'] {
  return {
    ...brief,
    riskAssessment: {
      ...brief.riskAssessment,
      // Keep the legacy field for one release while downstream consumers migrate.
      riskLevel: brief.riskAssessment.upholdRiskLevel,
    },
  };
}
