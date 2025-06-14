// src/app/api/dashboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface FilterParams {
  years: string[];
  firms: string[];
  products: string[];
}

interface KpisResult {
  total_complaints: number;
  total_firms: number;
  avg_upheld_rate: number | null;
  total_rows: number;
}

interface UpheldResult {
  avg_percentage_upheld: number | null;
}

interface EightWeeksResult {
  avg_closed_within_8_weeks: number | null;
}

interface SectorResult {
  product_category: string;
  avg_uphold_rate: number | null;
  avg_closure_rate?: number | null;
  complaint_count?: number;
}

interface PerformerResult {
  firm_name: string;
  complaint_count: number;
  avg_uphold_rate: number | null;
  avg_closure_rate: number | null;
}

interface ConsumerCreditResult {
  firm_name: string;
  total_received: number;
  total_closed: number;
  avg_upheld_pct: number | null;
  avg_closure_rate: number | null;
  period_count: number;
}

interface FirmResult {
  firm_name: string;
}

interface CategoryResult {
  product_category: string;
  complaint_count: number;
  avg_uphold_rate: number | null;
  avg_closure_rate: number | null;
}

interface HistoricalTrendResult {
  firm_name: string;
  reporting_period: string;
  product_category: string;
  upheld_rate: number | null;
  closure_rate_3_days: number | null;
  closure_rate_8_weeks: number | null;
  trend_year: string;
}

interface IndustryTrendResult {
  period: string;
  avg_upheld_rate: number | null;
  avg_closure_rate: number | null;
  firm_count: number;
  record_count: number;
}

// Safe conversion helpers
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
    const { searchParams } = new URL(request.url);
    const filters: FilterParams = {
      years: searchParams.get('years')?.split(',').filter(Boolean) || [],
      firms: searchParams.get('firms')?.split(',').filter(Boolean) || [],
      products: searchParams.get('products')?.split(',').filter(Boolean) || []
    };

    // Build WHERE clause for staging table
    const mainWhere = (() => {
      const parts: string[] = ['1=1'];
      if (filters.years.length) {
        parts.push(`(${filters.years.map(y =>
          `cms.reporting_period LIKE '%${y.replace(/'/g,"''")}%'`
        ).join(' OR ')})`);
      }
      if (filters.firms.length) {
        parts.push(`(${filters.firms.map(f =>
          `cms.firm_name = '${f.replace(/'/g,"''")}'`
        ).join(' OR ')})`);
      }
      if (filters.products.length) {
        parts.push(`(${filters.products.map(p =>
          `cms.product_category = '${p.replace(/'/g,"''")}'`
        ).join(' OR ')})`);
      }
      return parts.join(' AND ');
    })();

    // Prepare containers
    let kpis: KpisResult[] = [];
    let upheld: UpheldResult[] = [];
    let eightWeeks: EightWeeksResult[] = [];
    let sectorUphold: SectorResult[] = [];
    let sectorClosure: SectorResult[] = [];
    let allSector: SectorResult[] = [];
    let topPerformers: PerformerResult[] = [];
    let productCategories: CategoryResult[] = [];
    let industryComparison: PerformerResult[] = [];
    let allFirms: FirmResult[] = [];
    let consumerCredit: ConsumerCreditResult[] = [];
    let historicalTrends: HistoricalTrendResult[] = [];
    let industryTrends: IndustryTrendResult[] = [];

    // 1. KPIs
    try {
      const q = `
        SELECT
          COUNT(*)                        AS total_complaints,
          COUNT(DISTINCT cms.firm_name)   AS total_firms,
          AVG(cms.upheld_rate_pct)        AS avg_upheld_rate,
          COUNT(*)                        AS total_rows
        FROM complaint_metrics_staging cms
        WHERE ${mainWhere}
      `;
      kpis = (await sql(q)) as KpisResult[];
    } catch {
      kpis = [{ total_complaints:0, total_firms:0, avg_upheld_rate:0, total_rows:0 }];
    }

    // 2. Average upheld
    try {
      const q = `
        SELECT AVG(cms.upheld_rate_pct) AS avg_percentage_upheld
        FROM complaint_metrics_staging cms
        WHERE ${mainWhere}
      `;
      upheld = (await sql(q)) as UpheldResult[];
    } catch {
      upheld = [{ avg_percentage_upheld: 0 }];
    }

    // 3. 8-weeks KPI
    try {
      const q = `
        SELECT AVG(cms.closed_after_3_days_within_8_weeks_pct)
               AS avg_closed_within_8_weeks
        FROM complaint_metrics_staging cms
        WHERE ${mainWhere}
      `;
      eightWeeks = (await sql(q)) as EightWeeksResult[];
    } catch {
      eightWeeks = [{ avg_closed_within_8_weeks: 0 }];
    }

    // 4. Sector uphold
    try {
      const q = `
        SELECT
          cms.product_category     AS product_category,
          AVG(cms.upheld_rate_pct) AS avg_uphold_rate
        FROM complaint_metrics_staging cms
        WHERE ${mainWhere}
          AND cms.product_category IS NOT NULL
        GROUP BY cms.product_category
        ORDER BY cms.product_category
      `;
      sectorUphold = (await sql(q)) as SectorResult[];
    } catch {
      sectorUphold = [];
    }

    // 5. Sector closure
    try {
      const q = `
        SELECT
          cms.product_category           AS product_category,
          AVG(cms.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics_staging cms
        WHERE ${mainWhere}
          AND cms.product_category IS NOT NULL
        GROUP BY cms.product_category
        ORDER BY cms.product_category
      `;
      sectorClosure = (await sql(q)) as SectorResult[];
    } catch {
      sectorClosure = [];
    }

    // 6. All-sector averages
    try {
      const q = `
        SELECT
          cms.product_category     AS product_category,
          AVG(cms.upheld_rate_pct) AS avg_uphold_rate,
          COUNT(*)                 AS complaint_count
        FROM complaint_metrics_staging cms
        WHERE ${mainWhere}
          AND cms.product_category IS NOT NULL
        GROUP BY cms.product_category
        ORDER BY cms.product_category
      `;
      allSector = (await sql(q)) as SectorResult[];
    } catch {
      allSector = [];
    }

    // 7. Top performers
    try {
      const q = `
        SELECT
          cms.firm_name                    AS firm_name,
          COUNT(*)                         AS complaint_count,
          AVG(cms.upheld_rate_pct)         AS avg_uphold_rate,
          AVG(cms.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics_staging cms
        WHERE ${mainWhere}
        GROUP BY cms.firm_name
        HAVING COUNT(*) > 0
        ORDER BY avg_upheld_rate ASC
        LIMIT 50
      `;
      topPerformers = (await sql(q)) as PerformerResult[];
    } catch {
      topPerformers = [];
    }

    // 8. Product categories distribution
    try {
      const q = `
        SELECT
          cms.product_category           AS product_category,
          COUNT(*)                       AS complaint_count,
          AVG(cms.upheld_rate_pct)       AS avg_uphold_rate,
          AVG(cms.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics_staging cms
        WHERE ${mainWhere}
          AND cms.product_category IS NOT NULL
        GROUP BY cms.product_category
        ORDER BY complaint_count DESC
      `;
      productCategories = (await sql(q)) as CategoryResult[];
    } catch {
      productCategories = [];
    }

    // 9. Industry comparison
    try {
      const q = `
        SELECT
          cms.firm_name                    AS firm_name,
          COUNT(*)                         AS complaint_count,
          AVG(cms.upheld_rate_pct)         AS avg_uphold_rate,
          AVG(cms.closed_within_3_days_pct) AS avg_closure_rate
        FROM complaint_metrics_staging cms
        WHERE ${mainWhere}
        GROUP BY cms.firm_name
        ORDER BY cms.firm_name ASC
      `;
      industryComparison = (await sql(q)) as PerformerResult[];
    } catch {
      industryComparison = [];
    }

    // 10. All firms
    try {
      const q = `
        SELECT DISTINCT cms.firm_name AS firm_name
        FROM complaint_metrics_staging cms
        WHERE cms.firm_name IS NOT NULL
          AND cms.firm_name != ''
        ORDER BY cms.firm_name ASC
      `;
      allFirms = (await sql(q)) as FirmResult[];
    } catch {
      allFirms = [];
    }

    // 11. Consumer credit (unchanged)
    try {
      const q = `
        SELECT 
          f.name AS firm_name,
          SUM(cc.complaints_received) AS total_received,
          SUM(cc.complaints_closed)   AS total_closed,
          ROUND(AVG(cc.complaints_upheld_pct), 2)   AS avg_upheld_pct,
          ROUND(
            (SUM(cc.complaints_closed)::decimal / 
             NULLIF(SUM(cc.complaints_received), 0)) * 100, 
          2) AS avg_closure_rate,
          COUNT(*) AS period_count
        FROM consumer_credit_metrics cc
        JOIN firms f ON cc.firm_id = f.id
        JOIN reporting_periods rp ON cc.reporting_period_id = rp.id
        WHERE 1=1
        GROUP BY f.name
        HAVING SUM(cc.complaints_received) > 0
        ORDER BY total_received DESC
      `;
      consumerCredit = (await sql(q)) as ConsumerCreditResult[];
    } catch {
      consumerCredit = [];
    }

    // 12. Historical trends
    try {
      const q = `
        SELECT
          cms.firm_name                               AS firm_name,
          cms.reporting_period                        AS reporting_period,
          cms.product_category                        AS product_category,
          cms.upheld_rate_pct                         AS upheld_rate,
          cms.closed_within_3_days_pct                AS closure_rate_3_days,
          cms.closed_after_3_days_within_8_weeks_pct  AS closure_rate_8_weeks,
          CASE
            WHEN cms.reporting_period LIKE '%2020%' THEN '2020'
            WHEN cms.reporting_period LIKE '%2021%' THEN '2021'
            WHEN cms.reporting_period LIKE '%2022%' THEN '2022'
            WHEN cms.reporting_period LIKE '%2023%' THEN '2023'
            WHEN cms.reporting_period LIKE '%2024%' THEN '2024'
            WHEN cms.reporting_period LIKE '%2025%' THEN '2025'
            ELSE 'Unknown'
          END AS trend_year
        FROM complaint_metrics_staging cms
        WHERE ${mainWhere}
          AND cms.reporting_period IS NOT NULL
        ORDER BY cms.firm_name, cms.reporting_period
        LIMIT 1000
      `;
      historicalTrends = (await sql(q)) as HistoricalTrendResult[];
    } catch {
      historicalTrends = [];
    }

    // 13. Industry trends
    try {
      const q = `
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
        FROM complaint_metrics_staging cms
        WHERE ${mainWhere}
          AND cms.reporting_period IS NOT NULL
        GROUP BY period
        HAVING period != 'Unknown'
        ORDER BY period DESC
      `;
      industryTrends = (await sql(q)) as IndustryTrendResult[];
    } catch {
      industryTrends = [];
    }

    // Build response
    const base = kpis[0] || { total_complaints:0, total_firms:0, avg_upheld_rate:0, total_rows:0 };
    const response = {
      success: true,
      filters,
      data: {
        kpis: {
          total_complaints: base.total_complaints,
          total_closed:     base.total_complaints,
          total_firms:      base.total_firms,
          avg_upheld_rate:  base.avg_upheld_rate ?? 0,
          total_rows:       base.total_rows,
          avg_percentage_upheld: upheld[0]?.avg_percentage_upheld ?? 0,
          avg_closed_within_8_weeks: eightWeeks[0]?.avg_closed_within_8_weeks ?? 0,
          sector_uphold_averages: sectorUphold.reduce((a,r)=>{a[r.product_category]=r.avg_uphold_rate??0;return a;},{ } as Record<string,number>),
          sector_closure_averages: sectorClosure.reduce((a,r)=>{a[r.product_category]=r.avg_closure_rate??0;return a;},{ } as Record<string,number>),
          all_sector_averages: allSector.reduce((a,r)=>{a[r.product_category]={uphold_rate:r.avg_uphold_rate??0,complaint_count:r.complaint_count??0};return a;},{ } as Record<string,{uphold_rate:number,complaint_count:number}>),
        },
        topPerformers: topPerformers.map(r=>({
          firm_name:r.firm_name, complaint_count:r.complaint_count,
          avg_uphold_rate:r.avg_uphold_rate??0, avg_closure_rate:r.avg_closure_rate??0
        })),
        consumerCredit: consumerCredit.map(r=>({
          firm_name:r.firm_name, total_received:r.total_received, total_closed:r.total_closed,
          avg_upheld_pct:r.avg_upheld_pct??0, avg_closure_rate:r.avg_closure_rate??0,
          period_count:r.period_count
        })),
        productCategories: productCategories.map(r=>({
          category_name:r.product_category, complaint_count:r.complaint_count,
          avg_uphold_rate:r.avg_uphold_rate??0, avg_closure_rate:r.avg_closure_rate??0
        })),
        industryComparison: industryComparison.map(r=>({
          firm_name:r.firm_name, complaint_count:r.complaint_count,
          avg_uphold_rate:r.avg_uphold_rate??0, avg_closure_rate:r.avg_closure_rate??0
        })),
        allFirms: allFirms.map(r=>({firm_name:r.firm_name})),
        historicalTrends: historicalTrends.map(r=>({
          firm_name:r.firm_name, reporting_period:r.reporting_period,
          product_category:r.product_category, upheld_rate:r.upheld_rate??0,
          closure_rate_3_days:r.closure_rate_3_days??0,
          closure_rate_8_weeks:r.closure_rate_8_weeks??0,
          trend_year:r.trend_year
        })),
        industryTrends: industryTrends.map(r=>({
          period:r.period, avg_upheld_rate:r.avg_upheld_rate??0,
          avg_closure_rate:r.avg_closure_rate??0, firm_count:r.firm_count,
          record_count:r.record_count
        }))
      },
      debug: {
        appliedFilters: filters,
        executionTime: `${Date.now()-startTime}ms`,
        dataSource: 'Neon PostgreSQL – staging',
        queryCounts: {
          kpis:kpis.length, topPerformers:topPerformers.length,
          consumerCredit:consumerCredit.length,
          productCategories:productCategories.length,
          industryComparison:industryComparison.length,
          allFirms:allFirms.length, sectorUphold:sectorUphold.length,
          sectorClosure:sectorClosure.length,
          allSectorAverages:allSector.length,
          historicalTrends:historicalTrends.length,
          industryTrends:industryTrends.length
        }
      }
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}