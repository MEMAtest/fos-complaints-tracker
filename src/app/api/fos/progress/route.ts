import { getProgressSummary } from '@/lib/fos/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const startYearParam = url.searchParams.get('startYear');
    const startYear = startYearParam ? Number.parseInt(startYearParam, 10) : undefined;
    const progress = await getProgressSummary(startYear);

    const years = progress.years.map((item) => ({
      year: item.year,
      decisions: item.decisions,
      status: 'complete',
      progressPct: 100,
    }));

    return Response.json({
      success: true,
      generatedAt: new Date().toISOString(),
      summary: {
        status: progress.ingestion.status,
        lastSuccessAt: progress.ingestion.lastSuccessAt,
        recordsIngested: progress.ingestion.recordsIngested,
        activeYear: progress.ingestion.activeYear,
      },
      years,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load progress status.',
      },
      { status: 500 }
    );
  }
}
