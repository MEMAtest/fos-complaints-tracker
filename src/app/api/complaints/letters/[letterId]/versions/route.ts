import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getComplaintLetterContext, listComplaintLetterVersions } from '@/lib/complaints/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ letterId: string }> }) {
  try {
    await requireAuthenticatedUser(request, 'viewer');
    const { letterId } = await params;
    const context = await getComplaintLetterContext(letterId);
    if (!context) {
      return Response.json({ success: false, error: 'Letter not found.' }, { status: 404 });
    }

    const versions = await listComplaintLetterVersions(letterId);
    return Response.json({ success: true, versions });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch letter versions.' }, { status });
  }
}
