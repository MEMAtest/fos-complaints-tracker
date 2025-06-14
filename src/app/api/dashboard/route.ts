// src/app/api/dashboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// ——— Filter types ———
interface FilterParams {
  years: string[];
  firms: string[];
  products: string[];
}

// ——— Helpers to coerce Postgres numerics into JS numbers ———
function safeNumber(v: any, f = 0): number {
  if (v == null || v === '') return f;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return isNaN(n) ? f : n;
}
function safeInt(v: any, f = 0): number {
  if (v == null || v === '') return f;
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  return isNaN(n) ? f : n;
}

export async function GET(req: NextRequest) {
  const t0 = Date.now();

  try {
    // 1) Parse filters
    const url = new URL(req.url);
    const filters: FilterParams = {
      years:    url.searchParams.get('years')?.split(',').filter(Boolean) || [],
      firms:    url.searchParams.get('firms')?.split(',').filter(Boolean) || [],
      products: url.searchParams.get('products')?.split(',').filter(Boolean) || []
    };

    // 2) Build WHERE clause against denormalised columns
    const conds: string[] = ['1=1'];
    if (filters.years.length) {
      const yr = filters.years
        .map(y => `cm.reporting_period LIKE '%${y.replace(/'/g,"''")}%'`)
        .join(' OR ');
      conds.push(`(${yr})`);
    }
    if (filters.firms.length) {
      const fm = filters.firms
        .map(f => `cm.firm_name = '${f.replace(/'/g,"''")}'`)
        .join(' OR ');
      conds.push(`(${fm})`);
    }
    if (filters.products.length) {
      const pc = filters.products
        .map(p => `cm.product_category = '${p.replace(/'/g,"''")}'`)
        .join(' OR ');
      conds.push(`(${pc})`);
    }
    const where = conds.join(' AND ');

    // 3) Containers for results
    let kpis: any[]          = [];
    let avgUpheld: any[]     = [];
    let avg8Weeks: any[]     = [];
    let secUphold: any[]     = [];
    let secClosure: any[]    = [];
    let allSector: any[]     = [];
    let topPerf: any[]       = [];
    let prodCats: any[]      = [];
    let indComp: any[]       = [];
    let allFirms: any[]      = [];
    let credit: any[]        = [];
    let histTrend: any[]     = [];
    let indTrend: any[]      = [];

    // 4.1 Total KPIs
    try {
      const q = `
        SELECT
          COUNT(*)                      AS total_complaints,
          COUNT(DISTINCT cm.firm_name)  AS total_firms,
          AVG(cm.upheld_rate_pct)       AS avg_upheld_rate,
          COUNT(*)                      AS total_rows
        FROM complaint_metrics cm
        WHERE ${where}
      `;
      kpis = await sql(q);
    } catch {
      kpis = [{ total_complaints:0, total_firms:0, avg_upheld_rate:0, total_rows:0 }];
    }

    // 4.2 Overall average upheld rate
    try {
      const q = `
        SELECT
          AVG(cm.upheld_rate_pct) AS avg_percentage_upheld
        FROM complaint_metrics cm
        WHERE ${where}
      `;
      avgUpheld = await sql(q);
    } catch {
      avgUpheld = [{ avg_percentage_upheld: 0 }];
    }

    // 4.3 Average closed within 8 weeks
    try {
      const q = `
        SELECT
          AVG(cm.closed_after_3_days_within_8_weeks_pct) AS avg_closed_within_8_weeks
        FROM complaint_metrics cm
        WHERE ${where}
      `;
      avg8Weeks = await sql(q);
    } catch {
      avg8Weeks = [{ avg_closed_within_8_weeks: 0 }];
    }

    // 4.4 Sector uphold averages
    try {
      const q = `
        SELECT
          cm.product_category        AS product_category,
          AVG(cm.upheld_rate_pct)    AS avg_uphold_rate
        FROM complaint_metrics cm
        WHERE ${where}
          AND cm.product_category IS NOT NULL
        GROUP BY cm.product_category
        ORDER BY cm.product_category
      `;
      secUphold = await sql(q);
    } catch {
      secUphold = [];
    }

    // 4.5 Sector 3-day closure averages
    try {
      const q = `
        SELECT
          cm.product_category           AS product_category,
          AVG(cm.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics cm
        WHERE ${where}
          AND cm.product_category IS NOT NULL
        GROUP BY cm.product_category
        ORDER BY cm.product_category
      `;
      secClosure = await sql(q);
    } catch {
      secClosure = [];
    }

    // 4.6 All-sector averages + counts
    try {
      const q = `
        SELECT
          cm.product_category        AS product_category,
          AVG(cm.upheld_rate_pct)    AS avg_uphold_rate,
          COUNT(*)                   AS complaint_count
        FROM complaint_metrics cm
        WHERE ${where}
          AND cm.product_category IS NOT NULL
        GROUP BY cm.product_category
        ORDER BY cm.product_category
      `;
      allSector = await sql(q);
    } catch {
      allSector = [];
    }

    // 4.7 Top 50 performers (lowest uphold rate)
    try {
      const q = `
        SELECT
          cm.firm_name               AS firm_name,
          COUNT(*)                   AS complaint_count,
          AVG(cm.upheld_rate_pct)    AS avg_uphold_rate,
          AVG(cm.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics cm
        WHERE ${where}
        GROUP BY cm.firm_name
        ORDER BY avg_uphold_rate ASC
        LIMIT 50
      `;
      topPerf = await sql(q);
    } catch {
      topPerf = [];
    }

    // 4.8 Product category breakdown
    try {
      const q = `
        SELECT
          cm.product_category           AS category_name,
          COUNT(*)                      AS complaint_count,
          AVG(cm.upheld_rate_pct)       AS avg_uphold_rate,
          AVG(cm.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics cm
        WHERE ${where}
        GROUP BY cm.product_category
        ORDER BY complaint_count DESC
      `;
      prodCats = await sql(q);
    } catch {
      prodCats = [];
    }

    // 4.9 Industry comparison
    try {
      const q = `
        SELECT
          cm.firm_name               AS firm_name,
          COUNT(*)                   AS complaint_count,
          AVG(cm.upheld_rate_pct)    AS avg_uphold_rate,
          AVG(cm.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics cm
        WHERE ${where}
        GROUP BY cm.firm_name
        ORDER BY cm.firm_name ASC
      `;
      indComp = await sql(q);
    } catch {
      indComp = [];
    }

    // 4.10 All available firms
    try {
      const q = `
        SELECT DISTINCT cm.firm_name AS firm_name
        FROM complaint_metrics cm
        WHERE ${where}
        ORDER BY cm.firm_name ASC
      `;
      allFirms = await sql(q);
    } catch {
      allFirms = [];
    }

    // 4.11 Consumer credit (still needs joins)
    try {
      const ccConds = ['1=1'];
      if (filters.years.length) {
        const yr = filters.years
          .map(y => `(rp.period_start LIKE '%${y.replace(/'/g,"''")}%' OR rp.period_end LIKE '%${y.replace(/'/g,"''")}%')`)
          .join(' OR ');
        ccConds.push(`(${yr})`);
      }
      if (filters.firms.length) {
        const fm = filters.firms
          .map(f => `f.name='${f.replace(/'/g,"''")}'`)
          .join(' OR ');
        ccConds.push(`(${fm})`);
      }
      const ccWhere = ccConds.join(' AND ');

      const q = `
        SELECT
          f.name                                        AS firm_name,
          SUM(cc.complaints_received)                   AS total_received,
          SUM(cc.complaints_closed)                     AS total_closed,
          ROUND(AVG(cc.complaints_upheld_pct),2)        AS avg_upheld_pct,
          ROUND(
            (SUM(cc.complaints_closed)::decimal 
             / NULLIF(SUM(cc.complaints_received),0)
            ) *100, 2
          )                                             AS avg_closure_rate,
          COUNT(*)                                      AS period_count
        FROM consumer_credit_metrics cc
        JOIN firms f               ON cc.firm_id            = f.id
        JOIN reporting_periods rp  ON cc.reporting_period_id= rp.id
        WHERE ${ccWhere}
        GROUP BY f.name
        HAVING SUM(cc.complaints_received)>0
        ORDER BY total_received DESC
      `;
      credit = await sql(q);
    } catch {
      credit = [];
    }

    // 4.12 Historical trends
    try {
      const q = `
        SELECT
          cm.firm_name,
          cm.reporting_period,
          cm.product_category,
          cm.upheld_rate_pct            AS upheld_rate,
          cm.closed_within_3_days_pct   AS closure_rate_3_days,
          cm.closed_after_3_days_within_8_weeks_pct AS closure_rate_8_weeks,
          CASE
            WHEN cm.reporting_period LIKE '%2020%' THEN '2020'
            WHEN cm.reporting_period LIKE '%2021%' THEN '2021'
            WHEN cm.reporting_period LIKE '%2022%' THEN '2022'
            WHEN cm.reporting_period LIKE '%2023%' THEN '2023'
            WHEN cm.reporting_period LIKE '%2024%' THEN '2024'
            ELSE 'Unknown'
          END                            AS trend_year
        FROM complaint_metrics cm
        WHERE ${where}
          AND cm.upheld_rate_pct IS NOT NULL
        ORDER BY cm.firm_name, cm.reporting_period
        LIMIT 1000
      `;
      histTrend = await sql(q);
    } catch {
      histTrend = [];
    }

    // 4.13 Industry trends
    try {
      const q = `
        SELECT
          CASE
            WHEN cm.reporting_period LIKE '%2020%' THEN '2020'
            WHEN cm.reporting_period LIKE '%2021%' THEN '2021'
            WHEN cm.reporting_period LIKE '%2022%' THEN '2022'
            WHEN cm.reporting_period LIKE '%2023%' THEN '2023'
            WHEN cm.reporting_period LIKE '%2024%' THEN '2024'
            ELSE 'Unknown'
          END                               AS period,
          AVG(cm.upheld_rate_pct)           AS avg_upheld_rate,
          AVG(cm.closed_within_3_days_pct)  AS avg_closure_rate,
          COUNT(DISTINCT cm.firm_name)      AS firm_count,
          COUNT(*)                          AS record_count
        FROM complaint_metrics cm
        WHERE ${where}
          AND cm.upheld_rate_pct IS NOT NULL
        GROUP BY period
        HAVING period!='Unknown'
        ORDER BY period DESC
      `;
      indTrend = await sql(q);
    } catch {
      indTrend = [];
    }

    // 5) Build JSON response
    const k = kpis[0] || { total_complaints:0, total_firms:0, avg_upheld_rate:0, total_rows:0 };
    const res = {
      success: true as const,
      filters,
      data: {
        kpis: {
          total_complaints:          safeInt(k.total_complaints),
          total_closed:              safeInt(k.total_complaints),
          total_firms:               safeInt(k.total_firms),
          avg_upheld_rate:           safeNumber(k.avg_upheld_rate),
          total_rows:                safeInt(k.total_rows),
          avg_percentage_upheld:     safeNumber(avgUpheld[0]?.avg_percentage_upheld),
          avg_closed_within_8_weeks: safeNumber(avg8Weeks[0]?.avg_closed_within_8_weeks)
        },
        sector_uphold_averages:   secUphold.reduce((o,r)=>(o[r.product_category]=safeNumber(r.avg_uphold_rate),o),{} as Record<string,number>),
        sector_closure_averages:  secClosure.reduce((o,r)=>(o[r.product_category]=safeNumber(r.avg_closure_rate),o),{} as Record<string,number>),
        all_sector_averages:      allSector.reduce((o,r)=>(o[r.product_category]={uphold_rate:safeNumber(r.avg_uphold_rate),complaint_count:safeInt(r.complaint_count)},o),{} as Record<string,{uphold_rate:number,complaint_count:number}>),
        topPerformers:            topPerf.map(r=>({
                                   firm_name:       r.firm_name,
                                   complaint_count: safeInt(r.complaint_count),
                                   avg_uphold_rate: safeNumber(r.avg_uphold_rate),
                                   avg_closure_rate: safeNumber(r.avg_closure_rate)
                                 })),
        productCategories:        prodCats.map(r=>({
                                   category_name:   r.category_name,
                                   complaint_count: safeInt(r.complaint_count),
                                   avg_uphold_rate: safeNumber(r.avg_uphold_rate),
                                   avg_closure_rate: safeNumber(r.avg_closure_rate)
                                 })),
        industryComparison:       indComp.map(r=>({
                                   firm_name:       r.firm_name,
                                   complaint_count: safeInt(r.complaint_count),
                                   avg_upheld_rate: safeNumber(r.avg_upheld_rate),
                                   avg_closure_rate: safeNumber(r.avg_closure_rate)
                                 })),
        allFirms:                 allFirms.map(r=>({ firm_name: r.firm_name })),
        consumerCredit:           credit.map(r=>({
                                   firm_name:        r.firm_name,
                                   total_received:   safeInt(r.total_received),
                                   total_closed:     safeInt(r.total_closed),
                                   avg_upheld_pct:   safeNumber(r.avg_upheld_pct),
                                   avg_closure_rate: safeNumber(r.avg_closure_rate),
                                   period_count:     safeInt(r.period_count)
                                 })),
        historicalTrends:         histTrend.map(r=>({
                                   firm_name:           r.firm_name,
                                   reporting_period:    r.reporting_period,
                                   product_category:    r.product_category,
                                   upheld_rate:         safeNumber(r.upheld_rate),
                                   closure_rate_3_days: safeNumber(r.closure_rate_3_days),
                                   closure_rate_8_weeks: safeNumber(r.closure_rate_8_weeks),
                                   trend_year:          r.trend_year
                                 })),
        industryTrends:           indTrend.map(r=>({
                                   period:             r.period,
                                   avg_upheld_rate:    safeNumber(r.avg_upheld_rate),
                                   avg_closure_rate:   safeNumber(r.avg_closure_rate),
                                   firm_count:         safeInt(r.firm_count),
                                   record_count:       safeInt(r.record_count)
                                 }))
      },
      debug: {
        appliedFilters: filters,
        executionTime:   `${Date.now() - t0}ms`,
        dataSource:      'Neon PostgreSQL – production'
      }
    };

    return NextResponse.json(res);
  } catch (err) {
    console.error('❌ Dashboard API error', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
