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
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch case list.',
      },
      { status: 500 }
    );
  }
}
