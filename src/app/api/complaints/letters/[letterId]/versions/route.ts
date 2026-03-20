import { NextRequest } from 'next/server';
import { getComplaintLetterContext, listComplaintLetterVersions } from '@/lib/complaints/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ letterId: string }> }) {
  try {
    const { letterId } = await params;
    const context = await getComplaintLetterContext(letterId);
    if (!context) {
      return Response.json({ success: false, error: 'Letter not found.' }, { status: 404 });
    }

    const versions = await listComplaintLetterVersions(letterId);
    return Response.json({ success: true, versions });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch letter versions.' }, { status: 500 });
  }
}
