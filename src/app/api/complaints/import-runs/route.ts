import { NextRequest } from 'next/server';
import { listComplaintImportRuns } from '@/lib/complaints/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const limitRaw = Number.parseInt(request.nextUrl.searchParams.get('limit') || '12', 10);
    const runs = await listComplaintImportRuns(Number.isInteger(limitRaw) ? limitRaw : 12);
    return Response.json({ success: true, runs });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch import runs.' }, { status: 500 });
  }
}
