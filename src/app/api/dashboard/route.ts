// src/app/api/dashboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Always-defined filter params
interface FilterParams {
  years: string[];
  firms: string[];
  products: string[];
}

// Helpers to coerce Postgres numerics (strings) into JS numbers
function safeNumber(value: any, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(n) ? fallback : n;
}
function safeInt(value: any, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  return isNaN(n) ? fallback : n;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1) Parse filters
    const { searchParams } = new URL(request.url);
    const filters: FilterParams = {
      years:    searchParams.get('years')?.split(',').filter(Boolean) || [],
      firms:    searchParams.get('firms')?.split(',').filter(Boolean) || [],
      products: searchParams.get('products')?.split(',').filter(Boolean) || []
    };

    // 2) Build WHERE clause
    const parts: string[] = ['1=1'];
    if (filters.years.length) {
      const yrs = filters.years
        .map(y => `(rp.period_start LIKE '%${y.replace(/'/g,"''")}%' OR rp.period_end LIKE '%${y.replace(/'/g,"''")}%')`)
        .join(' OR ');
      parts.push(`(${yrs})`);
    }
    if (filters.firms.length) {
      const fms = filters.firms
        .map(f => `f.name = '${f.replace(/'/g,"''")}'`)
        .join(' OR ');
      parts.push(`(${fms})`);
    }
    if (filters.products.length) {
      const pcs = filters.products
        .map(p => `pc.name = '${p.replace(/'/g,"''")}'`)
        .join(' OR ');
      parts.push(`(${pcs})`);
    }
    const whereClause = parts.join(' AND ');

    // 3) Prepare result buckets
    let kpisResult: any[]           = [];
    let overviewResult: any[]       = [];
    let eightWeeksResult: any[]     = [];
    let sectorUpholdResult: any[]   = [];
    let sectorClosureResult: any[]  = [];
    let allSectorResult: any[]      = [];
    let topPerformersResult: any[]  = [];
    let productCatResult: any[]     = [];
    let industryCompResult: any[]   = [];
    let allFirmsResult: any[]       = [];
    let creditResult: any[]         = [];
    let histTrendResult: any[]      = [];
    let indTrendResult: any[]       = [];

    // 4.1 KPIs
    try {
      const q = `
        SELECT
          COUNT(*)                             AS total_complaints,
          COUNT(DISTINCT f.name)              AS total_firms,
          AVG(CAST(cm.upheld_rate_pct AS DECIMAL)) AS avg_upheld_rate,
          COUNT(*)                             AS total_rows
        FROM complaint_metrics cm
        JOIN firms f               ON cm.firm_id             = f.id
        JOIN reporting_periods rp  ON cm.reporting_period_id = rp.id
        JOIN product_categories pc ON cm.product_category_id  = pc.id
        WHERE ${whereClause}
      `;
      kpisResult = await sql(q);
    } catch {
      kpisResult = [{ total_complaints:0, total_firms:0, avg_upheld_rate:0, total_rows:0 }];
    }

    // 4.2 Overview uphold %
    try {
      const q = `
        SELECT
          AVG(CAST(cm.upheld_rate_pct AS DECIMAL)) AS avg_percentage_upheld
        FROM complaint_metrics cm
        JOIN reporting_periods rp ON cm.reporting_period_id = rp.id
        WHERE ${whereClause}
      `;
      overviewResult = await sql(q);
    } catch {
      overviewResult = [{ avg_percentage_upheld: 0 }];
    }

    // 4.3 8-weeks KPI
    try {
      const q = `
        SELECT
          AVG(CAST(cm.closed_after_3_days_within_8_weeks_pct AS DECIMAL)) AS avg_closed_within_8_weeks
        FROM complaint_metrics cm
        JOIN reporting_periods rp ON cm.reporting_period_id = rp.id
        WHERE ${whereClause}
      `;
      eightWeeksResult = await sql(q);
    } catch {
      eightWeeksResult = [{ avg_closed_within_8_weeks: 0 }];
    }

    // 4.4 Sector uphold
    try {
      const q = `
        SELECT
          pc.name                                   AS product_category,
          AVG(CAST(cm.upheld_rate_pct AS DECIMAL))  AS avg_uphold_rate
        FROM complaint_metrics cm
        JOIN product_categories pc ON cm.product_category_id = pc.id
        WHERE ${whereClause}
        GROUP BY pc.name
        ORDER BY pc.name
      `;
      sectorUpholdResult = await sql(q);
    } catch {
      sectorUpholdResult = [];
    }

    // 4.5 Sector closure
    try {
      const q = `
        SELECT
          pc.name                                          AS product_category,
          AVG(CAST(cm.closed_within_3_days_pct AS DECIMAL)) AS avg_closure_rate
        FROM complaint_metrics cm
        JOIN product_categories pc ON cm.product_category_id = pc.id
        WHERE ${whereClause}
        GROUP BY pc.name
        ORDER BY pc.name
      `;
      sectorClosureResult = await sql(q);
    } catch {
      sectorClosureResult = [];
    }

    // 4.6 All-sector averages
    try {
      const q = `
        SELECT
          pc.name                                   AS product_category,
          AVG(CAST(cm.upheld_rate_pct AS DECIMAL))  AS avg_upheld_rate,
          COUNT(*)                                  AS complaint_count
        FROM complaint_metrics cm
        JOIN product_categories pc ON cm.product_category_id = pc.id
        WHERE ${whereClause}
        GROUP BY pc.name
        ORDER BY pc.name
      `;
      allSectorResult = await sql(q);
    } catch {
      allSectorResult = [];
    }

    // 4.7 Top performers
    try {
      const q = `
        SELECT
          f.name                                    AS firm_name,
          COUNT(*)                                  AS complaint_count,
          AVG(CAST(cm.upheld_rate_pct AS DECIMAL))     AS avg_uphold_rate,
          AVG(CAST(cm.closed_within_3_days_pct AS DECIMAL)) AS avg_closure_rate
        FROM complaint_metrics cm
        JOIN firms f ON cm.firm_id = f.id
        WHERE ${whereClause}
        GROUP BY f.name
        ORDER BY avg_upheld_rate ASC
        LIMIT 50
      `;
      topPerformersResult = await sql(q);
    } catch {
      topPerformersResult = [];
    }

    // 4.8 Product categories
    try {
      const q = `
        SELECT
          pc.name                                          AS category_name,
          COUNT(*)                                         AS complaint_count,
          AVG(CAST(cm.upheld_rate_pct AS DECIMAL))         AS avg_uphold_rate,
          AVG(CAST(cm.closed_within_3_days_pct AS DECIMAL)) AS avg_closure_rate
        FROM complaint_metrics cm
        JOIN product_categories pc ON cm.product_category_id = pc.id
        WHERE ${whereClause}
        GROUP BY pc.name
        ORDER BY complaint_count DESC
      `;
      productCatResult = await sql(q);
    } catch {
      productCatResult = [];
    }

    // 4.9 Industry comparison
    try {
      const q = `
        SELECT
          f.name                                    AS firm_name,
          COUNT(*)                                  AS complaint_count,
          AVG(CAST(cm.upheld_rate_pct AS DECIMAL))     AS avg_uphold_rate,
          AVG(CAST(cm.closed_within_3_days_pct AS DECIMAL)) AS avg_closure_rate
        FROM complaint_metrics cm
        JOIN firms f ON cm.firm_id = f.id
        WHERE ${whereClause}
        GROUP BY f.name
        ORDER BY f.name ASC
      `;
      industryCompResult = await sql(q);
    } catch {
      industryCompResult = [];
    }

    // 4.10 All firms
    try {
      const q = `
        SELECT DISTINCT f.name AS firm_name
        FROM complaint_metrics cm
        JOIN firms f ON cm.firm_id = f.id
        WHERE ${whereClause}
        ORDER BY f.name ASC
      `;
      allFirmsResult = await sql(q);
    } catch {
      allFirmsResult = [];
    }

    // 4.11 Consumer credit
    try {
      const ccParts: string[] = ['1=1'];
      if (filters.years.length) {
        const yrs = filters.years
          .map(y => `(rp.period_start LIKE '%${y.replace(/'/g,"''")}%' OR rp.period_end LIKE '%${y.replace(/'/g,"''")}%')`)
          .join(' OR ');
        ccParts.push(`(${yrs})`);
      }
      if (filters.firms.length) {
        const fms = filters.firms
          .map(f => `f.name = '${f.replace(/'/g,"''")}'`)
          .join(' OR ');
        ccParts.push(`(${fms})`);
      }
      const ccWhere = ccParts.join(' AND ');

      const q = `
        SELECT
          f.name                                         AS firm_name,
          SUM(cc.complaints_received)                    AS total_received,
          SUM(cc.complaints_closed)                      AS total_closed,
          ROUND(AVG(cc.complaints_upheld_pct),2)         AS avg_upheld_pct,
          ROUND(
            (SUM(cc.complaints_closed)::decimal
             / NULLIF(SUM(cc.complaints_received),0))
            *100,2
          )                                              AS avg_closure_rate,
          COUNT(*)                                       AS period_count
        FROM consumer_credit_metrics cc
        JOIN firms f               ON cc.firm_id             = f.id
        JOIN reporting_periods rp  ON cc.reporting_period_id = rp.id
        WHERE ${ccWhere}
        GROUP BY f.name
        HAVING SUM(cc.complaints_received)>0
        ORDER BY total_received DESC
      `;
      creditResult = await sql(q);
    } catch {
      creditResult = [];
    }

    // 4.12 Historical trends
    try {
      const q = `
        SELECT
          cm.firm_name,
          cm.reporting_period,
          cm.product_category,
          CAST(cm.upheld_rate_pct           AS DECIMAL) AS upheld_rate,
          CAST(cm.closed_within_3_days_pct  AS DECIMAL) AS closure_rate_3_days,
          CAST(cm.closed_after_3_days_within_8_weeks_pct AS DECIMAL) AS closure_rate_8_weeks,
          CASE
            WHEN cm.reporting_period LIKE '%2020%' THEN '2020'
            WHEN cm.reporting_period LIKE '%2021%' THEN '2021'
            WHEN cm.reporting_period LIKE '%2022%' THEN '2022'
            WHEN cm.reporting_period LIKE '%2023%' THEN '2023'
            WHEN cm.reporting_period LIKE '%2024%' THEN '2024'
            ELSE 'Unknown'
          END AS trend_year
        FROM complaint_metrics cm
        WHERE ${whereClause}
          AND cm.upheld_rate_pct IS NOT NULL
        ORDER BY cm.firm_name, cm.reporting_period
        LIMIT 1000
      `;
      histTrendResult = await sql(q);
    } catch {
      histTrendResult = [];
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
          END                                         AS period,
          AVG(CAST(cm.upheld_rate_pct AS DECIMAL))     AS avg_upheld_rate,
          AVG(CAST(cm.closed_within_3_days_pct AS DECIMAL)) AS avg_closure_rate,
          COUNT(DISTINCT cm.firm_name)                 AS firm_count,
          COUNT(*)                                     AS record_count
        FROM complaint_metrics cm
        WHERE ${whereClause}
          AND cm.upheld_rate_pct IS NOT NULL
        GROUP BY period
        HAVING period != 'Unknown'
        ORDER BY period DESC
      `;
      indTrendResult = await sql(q);
    } catch {
      indTrendResult = [];
    }

    // 5) Build final JSON response
    const base = kpisResult[0] || { total_complaints:0, total_firms:0, avg_upheld_rate:0, total_rows:0 };
    const json = {
      success: true as const,
      filters,
      data: {
        kpis: {
          total_complaints:         safeInt(base.total_complaints),
          total_closed:             safeInt(base.total_complaints),
          total_firms:              safeInt(base.total_firms),
          avg_upheld_rate:          safeNumber(base.avg_upheld_rate),
          total_rows:               safeInt(base.total_rows),
          avg_percentage_upheld:    safeNumber(overviewResult[0]?.avg_percentage_upheld),
          avg_closed_within_8_weeks:safeNumber(eightWeeksResult[0]?.avg_closed_within_8_weeks),
        },
        sector_uphold_averages: sectorUpholdResult .reduce((o,r)=>(o[r.product_category]=safeNumber(r.avg_uphold_rate),o),{} as Record<string,number>),
        sector_closure_averages: sectorClosureResult.reduce((o,r)=>(o[r.product_category]=safeNumber(r.avg_closure_rate),o),{} as Record<string,number>),
        all_sector_averages:     allSectorResult   .reduce((o,r)=>(o[r.product_category]={uphold_rate:safeNumber(r.avg_upheld_rate),complaint_count:safeInt(r.complaint_count)},o),{} as Record<string,{uphold_rate:number,complaint_count:number}>),
        topPerformers:           topPerformersResult.map(r=>({
                                   firm_name:       r.firm_name,
                                   complaint_count: safeInt(r.complaint_count),
                                   avg_uphold_rate: safeNumber(r.avg_uphold_rate),
                                   avg_closure_rate:safeNumber(r.avg_closure_rate)
                                 })),
        productCategories:       productCatResult .map(r=>({
                                   category_name:   r.category_name,
                                   complaint_count: safeInt(r.complaint_count),
                                   avg_uphold_rate: safeNumber(r.avg_uphold_rate),
                                   avg_closure_rate:safeNumber(r.avg_closure_rate)
                                 })),
        industryComparison:      industryCompResult.map(r=>({
                                   firm_name:       r.firm_name,
                                   complaint_count: safeInt(r.complaint_count),
                                   avg_upheld_rate: safeNumber(r.avg_upheld_rate),
                                   avg_closure_rate:safeNumber(r.avg_closure_rate)
                                 })),
        allFirms:                allFirmsResult   .map(r=>({ firm_name:r.firm_name })),
        consumerCredit:          creditResult     .map(r=>({
                                   firm_name:        r.firm_name,
                                   total_received:   safeInt(r.total_received),
                                   total_closed:     safeInt(r.total_closed),
                                   avg_upheld_pct:   safeNumber(r.avg_upheld_pct),
                                   avg_closure_rate: safeNumber(r.avg_closure_rate),
                                   period_count:     safeInt(r.period_count)
                                 })),
        historicalTrends:        histTrendResult  .map(r=>({
                                   firm_name:           r.firm_name,
                                   reporting_period:    r.reporting_period,
                                   product_category:    r.product_category,
                                   upheld_rate:         safeNumber(r.upheld_rate),
                                   closure_rate_3_days: safeNumber(r.closure_rate_3_days),
                                   closure_rate_8_weeks:safeNumber(r.closure_rate_8_weeks),
                                   trend_year:          r.trend_year
                                 })),
        industryTrends:          indTrendResult   .map(r=>({
                                   period:            r.period,
                                   avg_upheld_rate:   safeNumber(r.avg_upheld_rate),
                                   avg_closure_rate:  safeNumber(r.avg_closure_rate),
                                   firm_count:        safeInt(r.firm_count),
                                   record_count:      safeInt(r.record_count)
                                 }))
      },
      debug: {
        appliedFilters: filters,
        executionTime:   `${Date.now() - startTime}ms`,
        dataSource:      'Neon PostgreSQL – production'
      }
    };

    return NextResponse.json(json);
  } catch (error) {
    console.error('❌ Dashboard API Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

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