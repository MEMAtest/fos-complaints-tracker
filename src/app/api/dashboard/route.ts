import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface FilterParams {
  years?: string[];
  firms?: string[];
  products?: string[];
}

// ✅ FIXED: Comprehensive type definitions for all query results
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

// ✅ BULLETPROOF: Safe number conversion with fallbacks
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
    console.log('🚀 API Dashboard called at:', new Date().toISOString());
    
    const { searchParams } = new URL(request.url);
    
    const filters: FilterParams = {
      years: searchParams.get('years')?.split(',').filter(Boolean) || [],
      firms: searchParams.get('firms')?.split(',').filter(Boolean) || [],
      products: searchParams.get('products')?.split(',').filter(Boolean) || []
    };

    console.log('🔍 Request filters:', filters);

    // ✅ UPDATED: Build WHERE clauses for JOINed tables based on real schema
    let mainWhereConditions = ["1=1"];
    let ccWhereConditions = ["1=1"];

    // Year filtering - using reporting_periods table
    if (filters.years && filters.years.length > 0) {
      const yearConditions = filters.years.map(year => 
        `(rp.period_start LIKE '%${year.replace(/'/g, "''")}%' OR rp.period_end LIKE '%${year.replace(/'/g, "''")}%')`
      );
      mainWhereConditions.push(`(${yearConditions.join(' OR ')})`);
      ccWhereConditions.push(`(${yearConditions.join(' OR ')})`);
    }

    // Firm filtering - using firms table
    if (filters.firms && filters.firms.length > 0) {
      const firmConditions = filters.firms.map(firm => `f.name = '${firm.replace(/'/g, "''")}'`);
      mainWhereConditions.push(`(${firmConditions.join(' OR ')})`);
      ccWhereConditions.push(`(${firmConditions.join(' OR ')})`);
    }

    // Product filtering - using product_categories table
    if (filters.products && filters.products.length > 0) {
      const productConditions = filters.products.map(product => `pc.name = '${product.replace(/'/g, "''")}'`);
      mainWhereConditions.push(`(${productConditions.join(' OR ')})`);
    }

    const mainWhereClause = mainWhereConditions.join(' AND ');
    const ccWhereClause = ccWhereConditions.join(' AND ');

    console.log('📝 Main WHERE clause:', mainWhereClause);

    // ✅ FIXED: Properly typed variable declarations (SOLVES TYPESCRIPT ERROR)
    let kpisResult: KpisResult[] = [];
    let overviewUpheldResult: UpheldResult[] = [];
    let sectorUpholdResult: SectorResult[] = [];
    let sectorClosureResult: SectorResult[] = [];
    let  eightWeeksKpiResult: EightWeeksResult[] = [];
    let topPerformersResult: PerformerResult[] = [];
    let productCategoriesResult: CategoryResult[] = [];
    let industryComparisonResult: PerformerResult[] = [];
    let allFirmsResult: FirmResult[] = [];
    let consumerCreditResult: ConsumerCreditResult[] = [];
    let historicalTrendsResult: HistoricalTrendResult[] = [];
    let industryTrendsResult: IndustryTrendResult[] = [];
    let allSectorAveragesResult: SectorResult[] = [];

    try {
      console.log('📊 Executing KPIs query...');
      let kpisQuery = `
  SELECT 
    COUNT(*) as total_complaints,
    COUNT(DISTINCT cms.firm_id) as total_firms,
    AVG(cms.upheld_rate_pct) as avg_upheld_rate,
    COUNT(*) as total_rows
  FROM complaint_metrics_staging cms
  JOIN firms f ON cms.firm_id = f.id
  JOIN reporting_periods rp ON cms.reporting_period_id = rp.id
  LEFT JOIN product_categories pc ON cms.product_category_id = pc.id
  WHERE ${mainWhereClause}
`;

const kpisQueryResult = await sql(kpisQuery);
      kpisResult = kpisQueryResult as KpisResult[];
      console.log('✅ KPIs query successful:', kpisResult?.length);
    } catch (error) {
      console.error('❌ KPIs query failed:', error);
      kpisResult = [{ total_complaints: 0, total_firms: 0, avg_upheld_rate: 0, total_rows: 0 }];
    }

    try {
      console.log('📊 Executing overview uphold query...');
      const overviewQueryResult = await sql`
        SELECT 
          AVG(cms.upheld_rate_pct) as avg_percentage_upheld
        FROM complaint_metrics_staging cms
        JOIN firms f ON cms.firm_id = f.id
        JOIN reporting_periods rp ON cms.reporting_period_id = rp.id
        LEFT JOIN product_categories pc ON cms.product_category_id = pc.id
        WHERE ${mainWhereClause}
      `;
      overviewUpheldResult = overviewQueryResult as UpheldResult[];
      console.log('✅ Overview uphold query successful');
    } catch (error) {
      console.error('❌ Overview uphold query failed:', error);
      overviewUpheldResult = [{ avg_percentage_upheld: 0 }];
    }

    try {
      console.log('📊 Executing 8-weeks KPI query...');
      const eightWeeksQueryResult = await sql`
        SELECT 
          AVG(cms.closed_after_3_days_within_8_weeks_pct) as avg_closed_within_8_weeks
        FROM complaint_metrics_staging cms
        JOIN firms f ON cms.firm_id = f.id
        JOIN reporting_periods rp ON cms.reporting_period_id = rp.id
        LEFT JOIN product_categories pc ON cms.product_category_id = pc.id
        WHERE ${mainWhereClause}
      `;
       eightWeeksKpiResult = eightWeeksQueryResult as EightWeeksResult[];
      console.log('✅ 8-weeks KPI query successful');
    } catch (error) {
      console.error('❌ 8-weeks KPI query failed:', error);
       eightWeeksKpiResult = [{ avg_closed_within_8_weeks: 0 }];
    }

    try {
      console.log('📊 Executing sector uphold query...');
      const sectorUpholdQueryResult = await sql`
        SELECT 
          COALESCE(pc.name, 'Unknown') as product_category,
          AVG(cms.upheld_rate_pct) as avg_uphold_rate
        FROM complaint_metrics_staging cms
        JOIN firms f ON cms.firm_id = f.id
        JOIN reporting_periods rp ON cms.reporting_period_id = rp.id
        LEFT JOIN product_categories pc ON cms.product_category_id = pc.id
        WHERE ${mainWhereClause}
          AND pc.name IS NOT NULL
        GROUP BY pc.name
        ORDER BY pc.name
      `;
      sectorUpholdResult = sectorUpholdQueryResult as SectorResult[];
      console.log('✅ Sector uphold query successful:', sectorUpholdResult?.length);
    } catch (error) {
      console.error('❌ Sector uphold query failed:', error);
      sectorUpholdResult = [];
    }

    try {
      console.log('📊 Executing sector closure query...');
      const sectorClosureQueryResult = await sql`
        SELECT 
          COALESCE(pc.name, 'Unknown') as product_category,
          AVG(cms.closed_within_3_days_pct) as avg_closure_rate
        FROM complaint_metrics_staging cms
        JOIN firms f ON cms.firm_id = f.id
        JOIN reporting_periods rp ON cms.reporting_period_id = rp.id
        LEFT JOIN product_categories pc ON cms.product_category_id = pc.id
        WHERE ${mainWhereClause}
          AND pc.name IS NOT NULL
        GROUP BY pc.name
        ORDER BY pc.name
      `;
      sectorClosureResult = sectorClosureQueryResult as SectorResult[];
      console.log('✅ Sector closure query successful:', sectorClosureResult?.length);
    } catch (error) {
      console.error('❌ Sector closure query failed:', error);
      sectorClosureResult = [];
    }

    try {
      console.log('📊 Executing all sector averages query...');
      const allSectorQueryResult = await sql`
        SELECT 
          COALESCE(pc.name, 'Unknown') as product_category,
          AVG(cms.upheld_rate_pct) as avg_uphold_rate,
          COUNT(*) as complaint_count
        FROM complaint_metrics_staging cms
        JOIN firms f ON cms.firm_id = f.id
        JOIN reporting_periods rp ON cms.reporting_period_id = rp.id
        LEFT JOIN product_categories pc ON cms.product_category_id = pc.id
        WHERE ${mainWhereClause}
          AND pc.name IS NOT NULL
        GROUP BY pc.name
        ORDER BY pc.name
      `;
      allSectorAveragesResult = allSectorQueryResult as SectorResult[];
      console.log('✅ All sector averages query successful:', allSectorAveragesResult?.length);
    } catch (error) {
      console.error('❌ All sector averages query failed:', error);
      allSectorAveragesResult = [];
    }

    try {
      console.log('📊 Executing top performers query...');
      const topPerformersQueryResult = await sql`
        SELECT 
          f.name as firm_name,
          COUNT(*) as complaint_count,
          AVG(cms.upheld_rate_pct) as avg_uphold_rate,
          AVG(cms.closed_within_3_days_pct) as avg_closure_rate
        FROM complaint_metrics_staging cms
        JOIN firms f ON cms.firm_id = f.id
        JOIN reporting_periods rp ON cms.reporting_period_id = rp.id
        LEFT JOIN product_categories pc ON cms.product_category_id = pc.id
        WHERE ${mainWhereClause}
        GROUP BY f.name
        HAVING COUNT(*) > 0
        ORDER BY avg_uphold_rate ASC
        LIMIT 50
      `;
      topPerformersResult = topPerformersQueryResult as PerformerResult[];
      console.log('✅ Top performers query successful:', topPerformersResult?.length);
    } catch (error) {
      console.error('❌ Top performers query failed:', error);
      topPerformersResult = [];
    }

    try {
      console.log('📊 Executing product categories query...');
      const productCategoriesQueryResult = await sql`
        SELECT 
          COALESCE(pc.name, 'Unknown') as product_category,
          COUNT(*) as complaint_count,
          AVG(cms.upheld_rate_pct) as avg_uphold_rate,
          AVG(cms.closed_within_3_days_pct) as avg_closure_rate
        FROM complaint_metrics_staging cms
        JOIN firms f ON cms.firm_id = f.id
        JOIN reporting_periods rp ON cms.reporting_period_id = rp.id
        LEFT JOIN product_categories pc ON cms.product_category_id = pc.id
        WHERE ${mainWhereClause}
          AND pc.name IS NOT NULL
        GROUP BY pc.name
        ORDER BY COUNT(*) DESC
      `;
      productCategoriesResult = productCategoriesQueryResult as CategoryResult[];
      console.log('✅ Product categories query successful:', productCategoriesResult?.length);
    } catch (error) {
      console.error('❌ Product categories query failed:', error);
      productCategoriesResult = [];
    }

    try {
      console.log('📊 Executing industry comparison query...');
      const industryComparisonQueryResult = await sql`
        SELECT 
          f.name as firm_name,
          COUNT(*) as complaint_count,
          AVG(cms.upheld_rate_pct) as avg_uphold_rate,
          AVG(cms.closed_within_3_days_pct) as avg_closure_rate
        FROM complaint_metrics_staging cms
        JOIN firms f ON cms.firm_id = f.id
        JOIN reporting_periods rp ON cms.reporting_period_id = rp.id
        LEFT JOIN product_categories pc ON cms.product_category_id = pc.id
        WHERE ${mainWhereClause}
        GROUP BY f.name
        HAVING COUNT(*) >= 1
        ORDER BY f.name ASC
      `;
      industryComparisonResult = industryComparisonQueryResult as PerformerResult[];
      console.log('✅ Industry comparison query successful:', industryComparisonResult?.length);
    } catch (error) {
      console.error('❌ Industry comparison query failed:', error);
      industryComparisonResult = [];
    }

    try {
      console.log('📊 Executing all firms query...');
      const allFirmsQueryResult = await sql`
        SELECT DISTINCT f.name as firm_name
        FROM firms f
        WHERE f.name IS NOT NULL 
          AND f.name != ''
        ORDER BY f.name ASC
      `;
      allFirmsResult = allFirmsQueryResult as FirmResult[];
      console.log('✅ All firms query successful:', allFirmsResult?.length);
    } catch (error) {
      console.error('❌ All firms query failed:', error);
      allFirmsResult = [];
    }

    try {
      console.log('📊 Executing consumer credit query...');
      const consumerCreditQueryResult = await sql`
        SELECT 
          f.name AS firm_name,
          SUM(cc.complaints_received) AS total_received,
          SUM(cc.complaints_closed) AS total_closed,
          ROUND(AVG(cc.complaints_upheld_pct), 2) AS avg_upheld_pct,
          ROUND(
            (SUM(cc.complaints_closed)::decimal / NULLIF(SUM(cc.complaints_received), 0)) * 100, 
            2
          ) AS avg_closure_rate,
          COUNT(*) as period_count
        FROM consumer_credit_metrics cc
        JOIN firms f ON cc.firm_id = f.id
        JOIN reporting_periods rp ON cc.reporting_period_id = rp.id
        WHERE ${ccWhereClause}
        GROUP BY f.name
        HAVING SUM(cc.complaints_received) > 0
        ORDER BY total_received DESC
      `;
      consumerCreditResult = consumerCreditQueryResult as ConsumerCreditResult[];
      console.log('✅ Consumer credit query successful:', consumerCreditResult?.length);
    } catch (error) {
      console.error('❌ Consumer credit query failed:', error);
      consumerCreditResult = [];
    }

    try {
      console.log('📊 Executing historical trends query...');
      const historicalTrendsQueryResult = await sql`
        SELECT 
          f.name as firm_name,
          COALESCE(rp.period_start || ' - ' || rp.period_end, 'Unknown') as reporting_period,
          COALESCE(pc.name, 'Unknown') as product_category,
          cms.upheld_rate_pct as upheld_rate,
          cms.closed_within_3_days_pct as closure_rate_3_days,
          cms.closed_after_3_days_within_8_weeks_pct as closure_rate_8_weeks,
          CASE 
            WHEN rp.period_start LIKE '%2020%' OR rp.period_end LIKE '%2020%' THEN '2020'
            WHEN rp.period_start LIKE '%2021%' OR rp.period_end LIKE '%2021%' THEN '2021'
            WHEN rp.period_start LIKE '%2022%' OR rp.period_end LIKE '%2022%' THEN '2022'
            WHEN rp.period_start LIKE '%2023%' OR rp.period_end LIKE '%2023%' THEN '2023'
            WHEN rp.period_start LIKE '%2024%' OR rp.period_end LIKE '%2024%' THEN '2024'
            WHEN rp.period_start LIKE '%2025%' OR rp.period_end LIKE '%2025%' THEN '2025'
            ELSE 'Unknown'
          END as trend_year
        FROM complaint_metrics_staging cms
        JOIN firms f ON cms.firm_id = f.id
        JOIN reporting_periods rp ON cms.reporting_period_id = rp.id
        LEFT JOIN product_categories pc ON cms.product_category_id = pc.id
        WHERE ${mainWhereClause}
          AND rp.period_start IS NOT NULL
        ORDER BY f.name, rp.period_start
        LIMIT 1000
      `;
      historicalTrendsResult = historicalTrendsQueryResult as HistoricalTrendResult[];
      console.log('✅ Historical trends query successful:', historicalTrendsResult?.length);
    } catch (error) {
      console.error('❌ Historical trends query failed:', error);
      historicalTrendsResult = [];
    }

    try {
      console.log('📊 Executing industry trends query...');
      const industryTrendsQueryResult = await sql`
        SELECT 
          CASE 
            WHEN rp.period_start LIKE '%2020%' OR rp.period_end LIKE '%2020%' THEN '2020'
            WHEN rp.period_start LIKE '%2021%' OR rp.period_end LIKE '%2021%' THEN '2021'
            WHEN rp.period_start LIKE '%2022%' OR rp.period_end LIKE '%2022%' THEN '2022'
            WHEN rp.period_start LIKE '%2023%' OR rp.period_end LIKE '%2023%' THEN '2023'
            WHEN rp.period_start LIKE '%2024%' OR rp.period_end LIKE '%2024%' THEN '2024'
            WHEN rp.period_start LIKE '%2025%' OR rp.period_end LIKE '%2025%' THEN '2025'
            ELSE 'Unknown'
          END as period,
          AVG(cms.upheld_rate_pct) as avg_upheld_rate,
          AVG(cms.closed_within_3_days_pct) as avg_closure_rate,
          COUNT(DISTINCT cms.firm_id) as firm_count,
          COUNT(*) as record_count
        FROM complaint_metrics_staging cms
        JOIN firms f ON cms.firm_id = f.id
        JOIN reporting_periods rp ON cms.reporting_period_id = rp.id
        LEFT JOIN product_categories pc ON cms.product_category_id = pc.id
        WHERE ${mainWhereClause}
          AND rp.period_start IS NOT NULL
        GROUP BY 
          CASE 
            WHEN rp.period_start LIKE '%2020%' OR rp.period_end LIKE '%2020%' THEN '2020'
            WHEN rp.period_start LIKE '%2021%' OR rp.period_end LIKE '%2021%' THEN '2021'
            WHEN rp.period_start LIKE '%2022%' OR rp.period_end LIKE '%2022%' THEN '2022'
            WHEN rp.period_start LIKE '%2023%' OR rp.period_end LIKE '%2023%' THEN '2023'
            WHEN rp.period_start LIKE '%2024%' OR rp.period_end LIKE '%2024%' THEN '2024'
            WHEN rp.period_start LIKE '%2025%' OR rp.period_end LIKE '%2025%' THEN '2025'
            ELSE 'Unknown'
          END
        HAVING 
          CASE 
            WHEN rp.period_start LIKE '%2020%' OR rp.period_end LIKE '%2020%' THEN '2020'
            WHEN rp.period_start LIKE '%2021%' OR rp.period_end LIKE '%2021%' THEN '2021'
            WHEN rp.period_start LIKE '%2022%' OR rp.period_end LIKE '%2022%' THEN '2022'
            WHEN rp.period_start LIKE '%2023%' OR rp.period_end LIKE '%2023%' THEN '2023'
            WHEN rp.period_start LIKE '%2024%' OR rp.period_end LIKE '%2024%' THEN '2024'
            WHEN rp.period_start LIKE '%2025%' OR rp.period_end LIKE '%2025%' THEN '2025'
            ELSE 'Unknown'
          END != 'Unknown'
        ORDER BY period DESC
      `;
      industryTrendsResult = industryTrendsQueryResult as IndustryTrendResult[];
      console.log('✅ Industry trends query successful:', industryTrendsResult?.length);
    } catch (error) {
      console.error('❌ Industry trends query failed:', error);
      industryTrendsResult = [];
    }

    // ✅ Process sector averages
    const sectorUpholdAverages: {[key: string]: number} = {};
    (sectorUpholdResult || []).forEach((row) => {
      if (row.product_category) {
        sectorUpholdAverages[row.product_category] = safeNumber(row.avg_uphold_rate);
      }
    });

    const sectorClosureAverages: {[key: string]: number} = {};
    (sectorClosureResult || []).forEach((row) => {
      if (row.product_category) {
        sectorClosureAverages[row.product_category] = safeNumber(row.avg_closure_rate);
      }
    });

    const allSectorAverages: {[key: string]: {uphold_rate: number, complaint_count: number}} = {};
    (allSectorAveragesResult || []).forEach((row) => {
      if (row.product_category) {
        allSectorAverages[row.product_category] = {
          uphold_rate: safeNumber(row.avg_uphold_rate),
          complaint_count: safeInt(row.complaint_count)
        };
      }
    });

    const executionTime = Date.now() - startTime;

    // ✅ Build response with safe data transformation
    const baseKpis = kpisResult?.[0] || {
      total_complaints: 0,
      total_firms: 0,
      avg_upheld_rate: 0,
      total_rows: 0
    };

    const response = {
      success: true,
      filters,
      data: {
        kpis: {
          total_complaints: safeInt(baseKpis.total_complaints),
          total_closed: safeInt(baseKpis.total_complaints),
          total_firms: safeInt(baseKpis.total_firms),
          avg_upheld_rate: safeNumber(baseKpis.avg_upheld_rate),
          total_rows: safeInt(baseKpis.total_rows),
          avg_percentage_upheld: safeNumber(overviewUpheldResult?.[0]?.avg_percentage_upheld),
          avg_closed_within_8_weeks: safeNumber(eightWeeksKpiResult?.[0]?.avg_closed_within_8_weeks),
          sector_uphold_averages: sectorUpholdAverages,
          sector_closure_averages: sectorClosureAverages,
          all_sector_averages: allSectorAverages
        },
        topPerformers: (topPerformersResult || []).map((item) => ({
          firm_name: item.firm_name,
          complaint_count: safeInt(item.complaint_count),
          avg_uphold_rate: safeNumber(item.avg_uphold_rate),
          avg_closure_rate: safeNumber(item.avg_closure_rate)
        })),
        consumerCredit: (consumerCreditResult || []).map((item) => ({
          firm_name: item.firm_name,
          total_received: safeInt(item.total_received),
          total_closed: safeInt(item.total_closed),
          avg_upheld_pct: safeNumber(item.avg_upheld_pct),
          avg_closure_rate: safeNumber(item.avg_closure_rate),
          period_count: safeInt(item.period_count)
        })),
        productCategories: (productCategoriesResult || []).map((item) => ({
          category_name: item.product_category,
          complaint_count: safeInt(item.complaint_count),
          avg_uphold_rate: safeNumber(item.avg_uphold_rate),
          avg_closure_rate: safeNumber(item.avg_closure_rate)
        })),
        industryComparison: (industryComparisonResult || []).map((item) => ({
          firm_name: item.firm_name,
          complaint_count: safeInt(item.complaint_count),
          avg_uphold_rate: safeNumber(item.avg_uphold_rate),
          avg_closure_rate: safeNumber(item.avg_closure_rate)
        })),
        allFirms: (allFirmsResult || []).map((item) => ({
          firm_name: item.firm_name
        })),
        historicalTrends: (historicalTrendsResult || []).map((item) => ({
          firm_name: item.firm_name,
          reporting_period: item.reporting_period,
          product_category: item.product_category,
          upheld_rate: safeNumber(item.upheld_rate),
          closure_rate_3_days: safeNumber(item.closure_rate_3_days),
          closure_rate_8_weeks: safeNumber(item.closure_rate_8_weeks),
          trend_year: item.trend_year
        })),
        industryTrends: (industryTrendsResult || []).map((item) => ({
          period: item.period,
          avg_upheld_rate: safeNumber(item.avg_upheld_rate),
          avg_closure_rate: safeNumber(item.avg_closure_rate),
          firm_count: safeInt(item.firm_count),
          record_count: safeInt(item.record_count)
        }))
      },
      debug: {
        appliedFilters: filters,
        executionTime: `${executionTime}ms`,
        dataSource: 'Neon PostgreSQL - SCHEMA MATCHED',
        queryCounts: {
          kpis: kpisResult?.length || 0,
          topPerformers: topPerformersResult?.length || 0,
          consumerCredit: consumerCreditResult?.length || 0,
          productCategories: productCategoriesResult?.length || 0,
          industryComparison: industryComparisonResult?.length || 0,
          allFirms: allFirmsResult?.length || 0,
          sectorUphold: sectorUpholdResult?.length || 0,
          sectorClosure: sectorClosureResult?.length || 0,
          allSectorAverages: allSectorAveragesResult?.length || 0,
          historicalTrends: historicalTrendsResult?.length || 0,
          industryTrends: industryTrendsResult?.length || 0
        }
      }
    };

    console.log('✅ API Response Summary:', {
      totalComplaints: response.data.kpis.total_complaints,
      totalFirms: response.data.kpis.total_firms,
      consumerCreditFirms: response.data.consumerCredit.length,
      topPerformers: response.data.topPerformers.length,
      executionTime: response.debug.executionTime
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Dashboard API Critical Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          executionTime: `${Date.now() - startTime}ms`,
          dataSource: 'Error occurred',
          stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : []
        }
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
