import { NextRequest } from 'next/server';
import { parseFilters, searchFirmDirectory } from '@/lib/fos/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const q = (request.nextUrl.searchParams.get('q') || '').trim();
    const limitRaw = Number.parseInt(request.nextUrl.searchParams.get('limit') || '25', 10);
    const limit = Number.isInteger(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 25;
    const results = await searchFirmDirectory(q, filters, limit);

    return Response.json({
      success: true,
      results,
      meta: {
        query: q,
        limit,
        totalMatched: results.length,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search firms.',
      },
      { status: 500 }
    );
  }
}
