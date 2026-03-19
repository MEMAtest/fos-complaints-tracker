import { NextRequest } from 'next/server';
import { getBoardPackPreview } from '@/lib/board-pack/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const preview = await getBoardPackPreview({
      title: searchParams.get('title') || 'FOS Complaints Board Pack',
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
    return Response.json(preview, { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=600' } });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to build board pack preview.' }, { status: 500 });
  }
}

function parseList(searchParams: URLSearchParams, key: string): string[] {
  return Array.from(new Set(searchParams.getAll(key).flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean)));
}
