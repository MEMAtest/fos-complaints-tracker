import { NextRequest, NextResponse } from 'next/server';
// This is the corrected import, reverting to your original correct implementation.
import { neon } from '@neondatabase/serverless';

// --- THIS IS STILL REQUIRED ---
// This line tells Next.js to always run this route dynamically at request time.
export const dynamic = 'force-dynamic';

// Instantiate the `sql` function correctly by calling `neon`.
// This requires your DATABASE_URL to be set in your .env.local file.
const sql = neon(process.env.DATABASE_URL!);


export async function GET(request: NextRequest) {
  try {
    // Correctly using nextUrl.searchParams which is recommended for App Router
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    switch (query) {
      case 'initial_load':
        // Fetch all data with proper JOINs to get real names
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
          firmMetrics,
          consumerCredit,
          kpis: kpis[0]
        });

      case 'firm_performance':
        const year = searchParams.get('year') || '2024';
        const firmPerformance = await sql`
          SELECT 
            cm.firm_id,
            f.firm_name,
            f.firm_group,
            pc.category_name,
            cm.closed_within_3_days_pct,
            cm.closed_after_3_days_within_8_weeks_pct,
            cm.upheld_rate_pct,
            cm.total_complaints
          FROM complaint_metrics cm
          LEFT JOIN firms f ON cm.firm_id = f.id
          LEFT JOIN product_categories pc ON cm.product_category_id = pc.id
          LEFT JOIN reporting_periods rp ON cm.reporting_period_id = rp.id
          WHERE rp.year::text = ${year}
          ORDER BY f.firm_name, pc.category_name
        `;
        return NextResponse.json(firmPerformance);

      case 'consumer_credit':
        const selectedFirms = searchParams.get('firms')?.split(',') || [];
        const ccYear = searchParams.get('year') || '2024';
        
        let consumerCreditQuery;
        if (selectedFirms.length > 0 && selectedFirms[0] !== '') {
          consumerCreditQuery = sql`
            SELECT 
              ccm.firm_id,
              f.firm_name,
              f.firm_group,
              rp.period_name,
              rp.year,
              ccm.complaints_received,
              ccm.complaints_closed,
              ccm.complaints_upheld_pct,
              ccm.reporting_frequency
            FROM consumer_credit_metrics ccm
            LEFT JOIN firms f ON ccm.firm_id = f.id
            LEFT JOIN reporting_periods rp ON ccm.reporting_period_id = rp.id
            WHERE f.firm_name = ANY(${selectedFirms}) AND rp.year::text = ${ccYear}
            ORDER BY ccm.complaints_received DESC
          `;
        } else {
          consumerCreditQuery = sql`
            SELECT 
              ccm.firm_id,
              f.firm_name,
              f.firm_group,
              rp.period_name,
              rp.year,
              ccm.complaints_received,
              ccm.complaints_closed,
              ccm.complaints_upheld_pct,
              ccm.reporting_frequency
            FROM consumer_credit_metrics ccm
            LEFT JOIN firms f ON ccm.firm_id = f.id
            LEFT JOIN reporting_periods rp ON ccm.reporting_period_id = rp.id
            WHERE rp.year::text = ${ccYear}
            ORDER BY ccm.complaints_received DESC
          `;
        }

        const consumerCreditData = await consumerCreditQuery;
        return NextResponse.json(consumerCreditData);

      case 'lookup_data':
        // Get all lookup table data for dropdowns/filters
        const [firmsData, categoriesData, periodsData] = await Promise.all([
          sql`SELECT id, firm_name, firm_group FROM firms ORDER BY firm_name`,
          sql`SELECT id, category_name FROM product_categories ORDER BY category_name`,
          sql`SELECT id, period_name, year FROM reporting_periods ORDER BY year DESC, period_name`
        ]);

        return NextResponse.json({ 
          firms: firmsData, 
          categories: categoriesData, 
          periods: periodsData 
        });

      case 'dashboard_kpis':
        // Get pre-calculated KPIs if available
        const dashboardKpis = await sql`SELECT * FROM dashboard_kpis ORDER BY created_at DESC LIMIT 1`;
        return NextResponse.json(dashboardKpis[0] || {});

      default:
        return NextResponse.json({ error: 'Invalid query parameter' }, { status: 400 });
    }
  } catch (err) {
    console.error('Database error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json({ 
      error: 'Database error', 
      details: errorMessage 
    }, { status: 500 });
  }
}

