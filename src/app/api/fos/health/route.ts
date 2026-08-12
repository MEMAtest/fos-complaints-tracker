import { getIngestionStatus } from '@/lib/fos/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ingestion = await getIngestionStatus();
    return Response.json(
      {
        success: true,
        checkedAt: new Date().toISOString(),
        dataThrough: ingestion.dataThrough,
        lastSuccessfulIngestion: ingestion.lastSuccessfulIngestion,
        lastSummaryRefresh: ingestion.lastSummaryRefresh,
        pipelineStatus: ingestion.pipelineStatus,
      },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } }
    );
  } catch {
    return Response.json(
      {
        success: false,
        checkedAt: new Date().toISOString(),
        dataThrough: null,
        lastSuccessfulIngestion: null,
        lastSummaryRefresh: null,
        pipelineStatus: 'error',
        error: 'Platform health is temporarily unavailable.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
