import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { exportComplaints, parseComplaintFilters } from '@/lib/complaints/repository';
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
    rateLimitOrThrow(clientKeyFromRequest(request, `complaints-export:${user.email}`), 20, 60_000);
    const filters = parseComplaintFilters(request.nextUrl.searchParams);
    const csv = await exportComplaints(filters);
    const stamp = new Date().toISOString().slice(0, 10);
    logRouteMetric({
      route: '/api/complaints/export',
      method: 'GET',
      status: 200,
      durationMs: Date.now() - startedAt,
      actor,
      detail: { query: filters.query, pageSize: filters.pageSize, letterStatus: filters.letterStatus },
    });
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="complaints-export-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    logRouteMetric({
      route: '/api/complaints/export',
      method: 'GET',
      status,
      durationMs: Date.now() - startedAt,
      actor,
      detail: { error: error instanceof Error ? error.message : 'Failed to export complaints.' },
    });
    if (error instanceof RateLimitError) {
      return Response.json({ success: false, error: error.message }, { status, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    }
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to export complaints.' }, { status });
  }
}
