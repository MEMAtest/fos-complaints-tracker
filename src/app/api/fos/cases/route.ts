import { NextRequest } from 'next/server';
import { getCaseList, parseFilters } from '@/lib/fos/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const caseList = await getCaseList(filters);
    return Response.json({
      success: true,
      generatedAt: new Date().toISOString(),
      filters,
      data: {
        cases: caseList.items,
        pagination: caseList.pagination,
      },
    });
  } catch (error) {
    console.error('FOS case list query failed', { error: error instanceof Error ? error.message : String(error) });
    return Response.json(
      {
        success: false,
        error: 'Case Explorer is temporarily unavailable. Retry in a moment; dashboard summaries remain available.',
        errorCode: 'CASE_LIST_TEMPORARILY_UNAVAILABLE',
        retryable: true,
      },
      { status: 503, headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' } }
    );
  }
}
