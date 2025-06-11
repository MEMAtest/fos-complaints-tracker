import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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
          WHERE rp.year = ${year}
          ORDER BY f.firm_name, pc.category_name
        `;
        return NextResponse.json(firmPerformance);

      case 'consumer_credit':
        const firms = searchParams.get('firms')?.split(',') || [];
        const ccYear = searchParams.get('year') || '2024';
        
        let consumerCreditQuery;
        if (firms.length > 0 && firms[0] !== '') {
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
            WHERE f.firm_name = ANY(${firms}) AND rp.year = ${ccYear}
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
            WHERE rp.year = ${ccYear}
            ORDER BY ccm.complaints_received DESC
          `;
        }

        const consumerCreditData = await consumerCreditQuery;
        return NextResponse.json(consumerCreditData);

      case 'lookup_data':
        // Get all lookup table data for dropdowns/filters
        const [firms, categories, periods] = await Promise.all([
          sql`SELECT id, firm_name, firm_group FROM firms ORDER BY firm_name`,
          sql`SELECT id, category_name FROM product_categories ORDER BY category_name`,
          sql`SELECT id, period_name, year FROM reporting_periods ORDER BY year DESC, period_name`
        ]);

        return NextResponse.json({ firms, categories, periods });

      case 'dashboard_kpis':
        // Get pre-calculated KPIs if available
        const dashboardKpis = await sql`SELECT * FROM dashboard_kpis ORDER BY created_at DESC LIMIT 1`;
        return NextResponse.json(dashboardKpis[0] || {});

      default:
        return NextResponse.json({ error: 'Invalid query parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ 
      error: 'Database error', 
      details: error.message 
    }, { status: 500 });
  }
}
