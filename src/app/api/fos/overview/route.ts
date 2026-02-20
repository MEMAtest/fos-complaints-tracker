import { NextRequest } from 'next/server';
import { getDashboardSnapshot, parseFilters } from '@/lib/fos/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const snapshot = await getDashboardSnapshot(filters, { includeCases: false });
    return Response.json({
      success: true,
      generatedAt: new Date().toISOString(),
      filters,
      data: snapshot.overview,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch overview.',
      },
      { status: 500 }
    );
  }
}
