import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getComplaintFacets } from '@/lib/complaints/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request, 'viewer');
    return Response.json({ success: true, facets: await getComplaintFacets() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: status === 500 ? 'Complaint filters are temporarily unavailable.' : error instanceof Error ? error.message : 'Failed to load filters.' }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
