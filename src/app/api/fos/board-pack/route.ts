import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getBoardPackPreview } from '@/lib/board-pack/repository';
import type { BoardPackTemplateKey } from '@/lib/board-pack/types';
import { clientKeyFromRequest, RateLimitError, rateLimitOrThrow } from '@/lib/server/rate-limit';
import { logRouteMetric } from '@/lib/server/route-metrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  let actor: string | null = null;
  try {
    const user = await requireAuthenticatedUser(request, 'viewer');
    actor = user.email;
    rateLimitOrThrow(clientKeyFromRequest(request, `board-pack-preview:${user.email}`), 60, 60_000);
    const searchParams = request.nextUrl.searchParams;
    const templateKey = parseTemplateKey(searchParams.get('templateKey'));
    const preview = await getBoardPackPreview({
      title: searchParams.get('title') || 'FOS Complaints Board Pack',
      templateKey,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      firms: parseList(searchParams, 'firm'),
      products: parseList(searchParams, 'product'),
      outcomes: parseList(searchParams, 'outcome'),
      includeOperationalComplaints: searchParams.get('includeOperationalComplaints') !== 'false',
      includeComparison: searchParams.get('includeComparison') === 'true',
      includeRootCauseDeepDive: searchParams.get('includeRootCauseDeepDive') !== 'false',
      includeAppendix: searchParams.get('includeAppendix') !== 'false',
    });
    logRouteMetric({
      route: '/api/fos/board-pack',
      method: 'GET',
      status: 200,
      durationMs: Date.now() - startedAt,
      actor,
      detail: { templateKey: templateKey || 'board', includeAppendix: preview.sections.some((section) => section.key === 'appendix' && section.status === 'included') },
    });
    return Response.json(preview, { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=600' } });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    logRouteMetric({
      route: '/api/fos/board-pack',
      method: 'GET',
      status,
      durationMs: Date.now() - startedAt,
      actor,
      detail: { error: error instanceof Error ? error.message : 'Failed to build board pack preview.' },
    });
    if (error instanceof RateLimitError) {
      return Response.json({ success: false, error: error.message }, { status, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    }
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to build board pack preview.' }, { status });
  }
}

function parseList(searchParams: URLSearchParams, key: string): string[] {
  return Array.from(new Set(searchParams.getAll(key).flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean)));
}

function parseTemplateKey(value: string | null): BoardPackTemplateKey | undefined {
  switch (value) {
    case 'board':
    case 'risk_committee':
    case 'exco':
    case 'complaints_mi':
      return value;
    default:
      return undefined;
  }
}
