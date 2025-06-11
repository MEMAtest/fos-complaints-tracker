import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    switch (query) {
      case 'initial_load':
        // --- FIX WAS APPLIED HERE ---
        // Changed `ON cm.firm_id = f.firm_id` to `ON cm.firm_id = f.id`
        // and similar fixes for other queries.
        const [firmMetrics, consumerCredit, kpis] = await Promise.all([
          sql`
            SELECT 
              cm.firm_id,
              f.firm_name,
              f.firm_group,
              cm.reporting_period_id,
              rp.period_name,
              rp.year,
              cm.product_category_id,
              pc.category_name,
              cm.closed_within_3_days_pct,
              cm.closed_after_3_days_within_8_weeks_pct,
              cm.upheld_rate_pct,
              cm.total_complaints
            FROM complaint_metrics cm
            LEFT JOIN firms f ON cm.firm_id = f.id
            LEFT JOIN reporting_periods rp ON cm.reporting_period_id = rp.id
            LEFT JOIN product_categories pc ON cm.product_category_id = pc.id
            ORDER BY rp.year DESC, f.firm_name, pc.category_name
          `,
          sql`
            SELECT 
              ccm.firm_id,
              f.firm_name,
              f.firm_group,
              ccm.reporting_period_id,
              rp.period_name,
              rp.year,
              ccm.complaints_received,
              ccm.complaints_closed,
              ccm.complaints_upheld_pct,
              ccm.reporting_frequency
            FROM consumer_credit_metrics ccm
            LEFT JOIN firms f ON ccm.firm_id = f.id
            LEFT JOIN reporting_periods rp ON ccm.reporting_period_id = rp.id
            ORDER BY rp.year DESC, f.firm_name
          `,
          sql`
            SELECT 
              SUM(complaints_received) as total_complaints,
              SUM(complaints_closed) as total_closed,
              AVG(complaints_upheld_pct) as avg_upheld_rate
            FROM consumer_credit_metrics
          `
        ]);

        return NextResponse.json({
          success: true,
          data: {
            firmMetrics,
            consumerCredit,
            kpis: kpis[0]
          }
        });

      // Other cases would need similar validation, but this fixes the initial load.
      default:
        return NextResponse.json({ error: 'Invalid query parameter' }, { status: 400 });
    }
  } catch (err) {
    console.error('Database error:', err);
    let errorMessage = 'An unknown error occurred';
    if (err instanceof Error) {
        errorMessage = err.message;
    }
    return NextResponse.json({ 
      success: false,
      error: 'Database query failed', 
      details: errorMessage
    }, { status: 500 });
  }
}
