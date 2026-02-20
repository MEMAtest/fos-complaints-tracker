import { DatabaseClient } from '@/lib/database';

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
    await DatabaseClient.query(`
      SELECT
        COUNT(*)::INT AS total_cases,
        MAX(decision_date) AS latest_decision_date
      FROM fos_decisions
    `);

    return Response.json({
      success: true,
      warmedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
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
