import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { listComplaintImportRuns } from '@/lib/complaints/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request, 'viewer');
    const limitRaw = Number.parseInt(request.nextUrl.searchParams.get('limit') || '12', 10);
    const runs = await listComplaintImportRuns(Number.isInteger(limitRaw) ? limitRaw : 12);
    return Response.json({ success: true, runs });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch import runs.' }, { status });
  }
}
