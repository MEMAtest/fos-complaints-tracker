import { NextResponse } from 'next/server';
import { DatabaseClient } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const tableRows = await DatabaseClient.query<{
      table_name: string;
      row_count: string;
    }>(
      `
        SELECT
          table_name,
          (
            SELECT reltuples::BIGINT
            FROM pg_class
            WHERE relname = t.table_name
          )::TEXT AS row_count
        FROM (
          VALUES ('fos_decisions'), ('fos_ingestion_runs')
        ) AS t(table_name)
      `
    );

    const coverage = await DatabaseClient.queryOne<{
      total_cases: string;
      earliest_decision_date: string | null;
      latest_decision_date: string | null;
      distinct_firms: string;
      distinct_products: string;
    }>(
      `
        SELECT
          COUNT(*)::TEXT AS total_cases,
          MIN(decision_date)::TEXT AS earliest_decision_date,
          MAX(decision_date)::TEXT AS latest_decision_date,
          COUNT(DISTINCT COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm'))::TEXT AS distinct_firms,
          COUNT(DISTINCT COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified'))::TEXT AS distinct_products
        FROM fos_decisions
      `
    );

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      tables: tableRows,
      coverage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to inspect FOS dataset.',
      },
      { status: 500 }
    );
  }
}
