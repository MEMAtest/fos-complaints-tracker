import { NextRequest } from 'next/server';
import { parseFilters } from '@/lib/fos/repository';
import { getCaseList } from '@/lib/fos/cases-repository';
import { FOSCasesApiResponse } from '@/types/fos-dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const result = await getCaseList(filters);

    return Response.json(
      {
        success: true,
        data: {
          items: result.items,
          pagination: result.pagination,
        },
        meta: {
          cached: false,
          queryMs: Date.now() - startedAt,
          snapshotAt: new Date().toISOString(),
        },
      } satisfies FOSCasesApiResponse,
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch cases.',
      },
      { status: 500 }
    );
  }
}
