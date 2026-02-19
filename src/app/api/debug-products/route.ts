import { NextResponse } from 'next/server';
import { DatabaseClient } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
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
