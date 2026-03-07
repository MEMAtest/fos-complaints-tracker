import { NextResponse } from 'next/server';
import { DatabaseClient } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorizeDebugRequest(request: Request): Response | null {
  const debugSecret = process.env.DEBUG_API_SECRET;
  if (!debugSecret) {
    return NextResponse.json(
      {
        success: false,
        error: 'DEBUG_API_SECRET is not configured.',
      },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${debugSecret}`) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized.',
      },
      { status: 401 }
    );
  }

  return null;
}

export async function GET(request: Request) {
  const authFailure = authorizeDebugRequest(request);
  if (authFailure) {
    return authFailure;
  }

  try {
    const products = await DatabaseClient.query<{
      product: string;
      total: string;
      upheld_rate: string;
    }>(
      `
        SELECT
          COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified') AS product,
          COUNT(*)::TEXT AS total,
          ROUND(
            COALESCE(
              COUNT(*) FILTER (
                WHERE LOWER(COALESCE(outcome, '')) LIKE '%upheld%'
                  AND LOWER(COALESCE(outcome, '')) NOT LIKE '%not upheld%'
              )::NUMERIC / NULLIF(COUNT(*), 0) * 100,
              0
            ),
            2
          )::TEXT AS upheld_rate
        FROM fos_decisions
        GROUP BY COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')
        ORDER BY COUNT(*) DESC, product ASC
      `
    );

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      products,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to inspect product distribution.',
      },
      { status: 500 }
    );
  }
}
