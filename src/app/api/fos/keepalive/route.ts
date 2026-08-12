import { getIngestionStatus } from '@/lib/fos/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const startedAt = Date.now();
  const configuredSecret = process.env.CRON_SECRET;
  if (configuredSecret) {
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader !== `Bearer ${configuredSecret}`) {
      return Response.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }
  }

  try {
    const ingestion = await getIngestionStatus();

    return Response.json({
      success: true,
      warmedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      dataThrough: ingestion.dataThrough,
      lastSuccessfulIngestion: ingestion.lastSuccessfulIngestion,
      lastSummaryRefresh: ingestion.lastSummaryRefresh,
      pipelineStatus: ingestion.pipelineStatus,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Keepalive query failed.',
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
