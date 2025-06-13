// src/app/api/dashboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface FilterParams {
  years?: string[];
  firms?: string[];
  products?: string[];
}

interface KpisResult {
  total_complaints: string | number;
  total_firms: string | number;
  avg_upheld_rate: string | number | null;
  total_rows: string | number;
}

interface UpheldResult {
  avg_percentage_upheld: string | number | null;
}

interface EightWeeksResult {
  avg_closed_within_8_weeks: string | number | null;
}

interface SectorResult {
  product_category: string;
  avg_uphold_rate?: string | number | null;
  avg_closure_rate?: string | number | null;
  complaint_count?: string | number | null;
}

interface PerformerResult {
  firm_name: string;
  complaint_count: string | number;
  avg_uphold_rate: string | number | null;
  avg_closure_rate: string | number | null;
}

interface ConsumerCreditResult {
  firm_name: string;
  total_received: string | number;
  total_closed: string | number;
  avg_upheld_pct: string | number | null;
  avg_closure_rate: string | number | null;
  period_count: string | number;
}

interface FirmResult {
  firm_name: string;
}

interface CategoryResult {
  product_category: string;
  complaint_count: string | number;
  avg_uphold_rate: string | number | null;
  avg_closure_rate: string | number | null;
}

interface HistoricalTrendResult {
  firm_name: string;
  reporting_period: string;
  product_category: string;
  upheld_rate: string | number | null;
  closure_rate_3_days: string | number | null;
  closure_rate_8_weeks: string | number | null;
  trend_year: string;
}

interface IndustryTrendResult {
  period: string;
  avg_upheld_rate: string | number | null;
  avg_closure_rate: string | number | null;
  firm_count: string | number;
  record_count: string | number;
}

// Safety helpers
function safeNumber(value: any, fallback: number = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? fallback : num;
}

function safeInt(value: any, fallback: number = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  return isNaN(num) ? fallback : num;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const filters: FilterParams = {
      years: searchParams.get('years')?.split(',').filter(Boolean) || [],
      firms: searchParams.get('firms')?.split(',').filter(Boolean) || [],
      products: searchParams.get('products')?.split(',').filter(Boolean) || []
    };

    // Build WHERE clauses for complaint_metrics
    const mainWhere: string = (() => {
      const clauses: string[] = ['1=1'];

      if (filters.years?.length) {
        const yc = filters.years
          .map(y => `cms.reporting_period LIKE '%${y.replace(/'/g,"''")}%'`)
          .join(' OR ');
        clauses.push(`(${yc})`);
      }

      if (filters.firms?.length) {
        const fc = filters.firms
          .map(f => `cms.firm_name = '${f.replace(/'/g,"''")}'`)
          .join(' OR ');
        clauses.push(`(${fc})`);
      }

      if (filters.products?.length) {
        const pc = filters.products
          .map(p => `cms.product_category = '${p.replace(/'/g,"''")}'`)
          .join(' OR ');
        clauses.push(`(${pc})`);
      }

      return clauses.join(' AND ');
    })();

    // Build WHERE clauses for consumer_credit_metrics (unchanged logic)
    const ccWhere: string = (() => {
      const clauses: string[] = ['1=1'];

      if (filters.years?.length) {
        const yc = filters.years
          .map(y => `(rp.period_start LIKE '%${y.replace(/'/g,"''")}%' OR rp.period_end LIKE '%${y.replace(/'/g,"''")}%')`)
          .join(' OR ');
        clauses.push(`(${yc})`);
      }

      if (filters.firms?.length) {
        const fc = filters.firms
          .map(f => `f.name = '${f.replace(/'/g,"''")}'`)
          .join(' OR ');
        clauses.push(`(${fc})`);
      }

      return clauses.join(' AND ');
    })();

    // Prepare result containers
    let kpisResult: KpisResult[] = [];
    let overviewUpheldResult: UpheldResult[] = [];
    let eightWeeksKpiResult: EightWeeksResult[] = [];
    let sectorUpholdResult: SectorResult[] = [];
    let sectorClosureResult: SectorResult[] = [];
    let allSectorAveragesResult: SectorResult[] = [];
    let topPerformersResult: PerformerResult[] = [];
    let productCategoriesResult: CategoryResult[] = [];
    let industryComparisonResult: PerformerResult[] = [];
    let allFirmsResult: FirmResult[] = [];
    let consumerCreditResult: ConsumerCreditResult[] = [];
    let historicalTrendsResult: HistoricalTrendResult[] = [];
    let industryTrendsResult: IndustryTrendResult[] = [];

    // 1. KPI summary
    try {
      const q = `
        SELECT
          COUNT(*)                        AS total_complaints,
          COUNT(DISTINCT cms.firm_name)   AS total_firms,
          AVG(cms.upheld_rate_pct)        AS avg_upheld_rate,
          COUNT(*)                        AS total_rows
        FROM complaint_metrics cms
        WHERE ${mainWhere}
      `;
      kpisResult = await sql(q) as KpisResult[];
    } catch {
      kpisResult = [{ total_complaints:0, total_firms:0, avg_upheld_rate:0, total_rows:0 }];
    }

    // 2. Average % upheld
    try {
      overviewUpheldResult = await sql`
        SELECT AVG(cms.upheld_rate_pct) AS avg_percentage_upheld
        FROM complaint_metrics cms
        WHERE ${mainWhere}
      ` as UpheldResult[];
    } catch {
      overviewUpheldResult = [{ avg_percentage_upheld: 0 }];
    }

    // 3. Average closed within 8 weeks
    try {
      eightWeeksKpiResult = await sql`
        SELECT AVG(cms.closed_after_3_days_within_8_weeks_pct)
               AS avg_closed_within_8_weeks
        FROM complaint_metrics cms
        WHERE ${mainWhere}
      ` as EightWeeksResult[];
    } catch {
      eightWeeksKpiResult = [{ avg_closed_within_8_weeks: 0 }];
    }

    // 4. Sector uphold
    try {
      sectorUpholdResult = await sql`
        SELECT cms.product_category     AS product_category,
               AVG(cms.upheld_rate_pct) AS avg_uphold_rate
        FROM complaint_metrics cms
        WHERE ${mainWhere}
          AND cms.product_category IS NOT NULL
        GROUP BY cms.product_category
        ORDER BY cms.product_category
      ` as SectorResult[];
    } catch {
      sectorUpholdResult = [];
    }

    // 5. Sector closure
    try {
      sectorClosureResult = await sql`
        SELECT cms.product_category           AS product_category,
               AVG(cms.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics cms
        WHERE ${mainWhere}
          AND cms.product_category IS NOT NULL
        GROUP BY cms.product_category
        ORDER BY cms.product_category
      ` as SectorResult[];
    } catch {
      sectorClosureResult = [];
    }

    // 6. All-sector averages
    try {
      allSectorAveragesResult = await sql`
        SELECT cms.product_category     AS product_category,
               AVG(cms.upheld_rate_pct) AS avg_uphold_rate,
               COUNT(*)                 AS complaint_count
        FROM complaint_metrics cms
        WHERE ${mainWhere}
          AND cms.product_category IS NOT NULL
        GROUP BY cms.product_category
        ORDER BY cms.product_category
      ` as SectorResult[];
    } catch {
      allSectorAveragesResult = [];
    }

    // 7. Top performers
    try {
      topPerformersResult = await sql`
        SELECT cms.firm_name                    AS firm_name,
               COUNT(*)                         AS complaint_count,
               AVG(cms.upheld_rate_pct)         AS avg_uphold_rate,
               AVG(cms.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics cms
        WHERE ${mainWhere}
        GROUP BY cms.firm_name
        HAVING COUNT(*) > 0
        ORDER BY avg_uphold_rate ASC
        LIMIT 50
      ` as PerformerResult[];
    } catch {
      topPerformersResult = [];
    }

    // 8. Product categories distribution
    try {
      productCategoriesResult = await sql`
        SELECT cms.product_category           AS product_category,
               COUNT(*)                       AS complaint_count,
               AVG(cms.upheld_rate_pct)       AS avg_uphold_rate,
               AVG(cms.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics cms
        WHERE ${mainWhere}
          AND cms.product_category IS NOT NULL
        GROUP BY cms.product_category
        ORDER BY complaint_count DESC
      ` as CategoryResult[];
    } catch {
      productCategoriesResult = [];
    }

    // 9. Industry comparison
    try {
      industryComparisonResult = await sql`
        SELECT cms.firm_name                    AS firm_name,
               COUNT(*)                         AS complaint_count,
               AVG(cms.upheld_rate_pct)         AS avg_uphold_rate,
               AVG(cms.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics cms
        WHERE ${mainWhere}
        GROUP BY cms.firm_name
        ORDER BY cms.firm_name ASC
      ` as PerformerResult[];
    } catch {
      industryComparisonResult = [];
    }

    // 10. All firms list
    try {
      allFirmsResult = await sql`
        SELECT DISTINCT cms.firm_name AS firm_name
        FROM complaint_metrics cms
        WHERE cms.firm_name IS NOT NULL
          AND cms.firm_name != ''
        ORDER BY cms.firm_name ASC
      ` as FirmResult[];
    } catch {
      allFirmsResult = [];
    }

    // 11. Consumer-credit metrics (unchanged)
    try {
      consumerCreditResult = await sql`
        SELECT 
          f.name AS firm_name,
          SUM(cc.complaints_received) AS total_received,
          SUM(cc.complaints_closed)   AS total_closed,
          ROUND(AVG(cc.complaints_upheld_pct), 2)   AS avg_upheld_pct,
          ROUND(
            (SUM(cc.complaints_closed)::decimal / NULLIF(SUM(cc.complaints_received), 0)) * 100, 
          2) AS avg_closure_rate,
          COUNT(*) AS period_count
        FROM consumer_credit_metrics cc
        JOIN firms f ON cc.firm_id = f.id
        JOIN reporting_periods rp ON cc.reporting_period_id = rp.id
        WHERE ${ccWhere}
        GROUP BY f.name
        HAVING SUM(cc.complaints_received) > 0
        ORDER BY total_received DESC
      ` as ConsumerCreditResult[];
    } catch {
      consumerCreditResult = [];
    }

    // 12. Historical trends
    try {
      historicalTrendsResult = await sql`
        SELECT
          cms.firm_name                       AS firm_name,
          cms.reporting_period                AS reporting_period,
          cms.product_category                AS product_category,
          cms.upheld_rate_pct                 AS upheld_rate,
          cms.closed_within_3_days_pct        AS closure_rate_3_days,
          cms.closed_after_3_days_within_8_weeks_pct AS closure_rate_8_weeks,
          CASE
            WHEN cms.reporting_period LIKE '%2020%' THEN '2020'
            WHEN cms.reporting_period LIKE '%2021%' THEN '2021'
            WHEN cms.reporting_period LIKE '%2022%' THEN '2022'
            WHEN cms.reporting_period LIKE '%2023%' THEN '2023'
            WHEN cms.reporting_period LIKE '%2024%' THEN '2024'
            WHEN cms.reporting_period LIKE '%2025%' THEN '2025'
            ELSE 'Unknown'
          END AS trend_year
        FROM complaint_metrics cms
        WHERE ${mainWhere}
          AND cms.reporting_period IS NOT NULL
        ORDER BY cms.firm_name, cms.reporting_period
        LIMIT 1000
      ` as HistoricalTrendResult[];
    } catch {
      historicalTrendsResult = [];
    }

    // 13. Industry trends
    try {
      industryTrendsResult = await sql`
        SELECT
          CASE
            WHEN cms.reporting_period LIKE '%2020%' THEN '2020'
            WHEN cms.reporting_period LIKE '%2021%' THEN '2021'
            WHEN cms.reporting_period LIKE '%2022%' THEN '2022'
            WHEN cms.reporting_period LIKE '%2023%' THEN '2023'
            WHEN cms.reporting_period LIKE '%2024%' THEN '2024'
            WHEN cms.reporting_period LIKE '%2025%' THEN '2025'
            ELSE 'Unknown'
          END AS period,
          AVG(cms.upheld_rate_pct)              AS avg_upheld_rate,
          AVG(cms.closed_within_3_days_pct)     AS avg_closure_rate,
          COUNT(DISTINCT cms.firm_name)         AS firm_count,
          COUNT(*)                              AS record_count
        FROM complaint_metrics cms
        WHERE ${mainWhere}
          AND cms.reporting_period IS NOT NULL
        GROUP BY period
        HAVING period != 'Unknown'
        ORDER BY period DESC
      ` as IndustryTrendResult[];
    } catch {
      industryTrendsResult = [];
    }

    // … Process sector averages, build `response` object exactly as before …
    const executionTime = Date.now() - startTime;
    // … your existing response‐building code …

    // … right after you’ve done all your queries and transformations …

// 14. Build the response payload
const response = {
  success: true,
  filters,
  data: {
    kpis: {
      total_complaints: safeInt(kpisResult[0]?.total_complaints),
      total_closed:    safeInt(kpisResult[0]?.total_complaints),
      total_firms:     safeInt(kpisResult[0]?.total_firms),
      avg_upheld_rate: safeNumber(kpisResult[0]?.avg_upheld_rate),
      total_rows:      safeInt(kpisResult[0]?.total_rows),
      avg_percentage_upheld: safeNumber(overviewUpheldResult[0]?.avg_percentage_upheld),
      avg_closed_within_8_weeks: safeNumber(eightWeeksKpiResult[0]?.avg_closed_within_8_weeks),
      sector_uphold_averages: sectorUpholdResult.reduce((acc, r) => { acc[r.product_category] = safeNumber(r.avg_uphold_rate); return acc; }, {} as Record<string, number>),
      sector_closure_averages: sectorClosureResult.reduce((acc, r) => { acc[r.product_category] = safeNumber(r.avg_closure_rate); return acc; }, {} as Record<string, number>),
      all_sector_averages: allSectorAveragesResult.reduce((acc, r) => {
        acc[r.product_category] = { uphold_rate: safeNumber(r.avg_uphold_rate), complaint_count: safeInt(r.complaint_count) };
        return acc;
      }, {} as Record<string, { uphold_rate: number; complaint_count: number }>)
    },
    topPerformers: topPerformersResult.map(r => ({
      firm_name: r.firm_name,
      complaint_count: safeInt(r.complaint_count),
      avg_uphold_rate: safeNumber(r.avg_uphold_rate),
      avg_closure_rate: safeNumber(r.avg_closure_rate)
    })),
    consumerCredit: consumerCreditResult.map(r => ({
      firm_name: r.firm_name,
      total_received: safeInt(r.total_received),
      total_closed: safeInt(r.total_closed),
      avg_upheld_pct: safeNumber(r.avg_upheld_pct),
      avg_closure_rate: safeNumber(r.avg_closure_rate),
      period_count: safeInt(r.period_count)
    })),
    productCategories: productCategoriesResult.map(r => ({
      category_name: r.product_category,
      complaint_count: safeInt(r.complaint_count),
      avg_uphold_rate: safeNumber(r.avg_uphold_rate),
      avg_closure_rate: safeNumber(r.avg_closure_rate)
    })),
    industryComparison: industryComparisonResult.map(r => ({
      firm_name: r.firm_name,
      complaint_count: safeInt(r.complaint_count),
      avg_uphold_rate: safeNumber(r.avg_uphold_rate),
      avg_closure_rate: safeNumber(r.avg_closure_rate)
    })),
    allFirms: allFirmsResult.map(r => ({ firm_name: r.firm_name })),
    historicalTrends: historicalTrendsResult.map(r => ({
      firm_name: r.firm_name,
      reporting_period: r.reporting_period,
      product_category: r.product_category,
      upheld_rate: safeNumber(r.upheld_rate),
      closure_rate_3_days: safeNumber(r.closure_rate_3_days),
      closure_rate_8_weeks: safeNumber(r.closure_rate_8_weeks),
      trend_year: r.trend_year
    })),
    industryTrends: industryTrendsResult.map(r => ({
      period: r.period,
      avg_upheld_rate: safeNumber(r.avg_upheld_rate),
      avg_closure_rate: safeNumber(r.avg_closure_rate),
      firm_count: safeInt(r.firm_count),
      record_count: safeInt(r.record_count)
    }))
  },
  debug: {
    appliedFilters: filters,
    executionTime: `${Date.now() - startTime}ms`,
    dataSource: 'Neon PostgreSQL – production',
    queryCounts: {
      kpis: kpisResult.length,
      topPerformers: topPerformersResult.length,
      consumerCredit: consumerCreditResult.length,
      productCategories: productCategoriesResult.length,
      industryComparison: industryComparisonResult.length,
      allFirms: allFirmsResult.length,
      sectorUphold: sectorUpholdResult.length,
      sectorClosure: sectorClosureResult.length,
      allSectorAverages: allSectorAveragesResult.length,
      historicalTrends: historicalTrendsResult.length,
      industryTrends: industryTrendsResult.length
    }
  }
};

// 15. Return it
return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
