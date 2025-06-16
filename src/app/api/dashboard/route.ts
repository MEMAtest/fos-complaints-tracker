// src/app/api/dashboard/route.ts
import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
const sql = neon(process.env.DATABASE_URL!);

interface FilterParams {
  years: string[];
  firms: string[];
  products: string[];
}

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
    console.log('🚀 API Dashboard called at:', new Date().toISOString());

    // 1) Parse filters
    const { searchParams } = new URL(request.url);
    const filters: FilterParams = {
      years: searchParams.get('years')?.split(',').filter(Boolean) || [],
      firms: searchParams.get('firms')?.split(',').filter(Boolean) || [],
      products: searchParams.get('products')?.split(',').filter(Boolean) || []
    };

    console.log('🔍 Request filters:', filters);

    // 2) Build WHERE clause for STAGING tables
    let whereConditions = [
      "reporting_period IS NOT NULL",
      "reporting_period != ''",
      "firm_name IS NOT NULL", 
      "firm_name != ''",
      // ✅ FIX: Filter out zero/null uphold rates globally
      "upheld_rate_pct IS NOT NULL",
      "upheld_rate_pct > 0"
    ];

    // Year filtering
    if (filters.years.length > 0) {
      const yearConditions = filters.years.map(year => 
        `reporting_period LIKE '%${year.replace(/'/g, "''")}%'`
      );
      whereConditions.push(`(${yearConditions.join(' OR ')})`);
    }

    // Firm filtering
    if (filters.firms.length > 0) {
      const firmConditions = filters.firms.map(firm => 
        `firm_name = '${firm.replace(/'/g, "''")}'`
      );
      whereConditions.push(`(${firmConditions.join(' OR ')})`);
    }

    // Product filtering
    if (filters.products.length > 0) {
      const productConditions = filters.products.map(product => 
        `product_category = '${product.replace(/'/g, "''")}'`
      );
      whereConditions.push(`(${productConditions.join(' OR ')})`);
    }

    const whereClause = whereConditions.join(' AND ');
    console.log('📝 SQL WHERE clause:', whereClause);

    // ✅ DEBUG: Check all product categories in database
    try {
      console.log('🔍 DEBUG: Checking all product categories in database...');
      const debugProductsQuery = `
        SELECT DISTINCT product_category, COUNT(*) as record_count
        FROM complaint_metrics_staging 
        WHERE product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY product_category
      `;
      const debugProducts = await sql(debugProductsQuery);
      console.log('📊 Available product categories:', debugProducts);
    } catch (error) {
      console.error('❌ Debug products query failed:', error);
    }

    // 3) Execute all queries
    let results: any = {};

    try {
      // 3.1 Basic KPIs
      console.log('📊 Executing KPIs query...');
      const kpisQuery = `
        SELECT 
          COUNT(*) as total_complaints,
          COUNT(DISTINCT firm_name) as total_firms,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_upheld_rate,
          COUNT(*) as total_rows
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
      `;
      const kpisResult = await sql(kpisQuery);
      results.kpis = kpisResult[0] || { total_complaints: 0, total_firms: 0, avg_upheld_rate: 0, total_rows: 0 };
      console.log('✅ KPIs result:', results.kpis);
    } catch (error) {
      console.error('❌ KPIs query failed:', error);
      results.kpis = { total_complaints: 0, total_firms: 0, avg_upheld_rate: 0, total_rows: 0 };
    }

    try {
      // ✅ NEW: 3-day closure rate KPI
      const threeDaysQuery = `
        SELECT 
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closed_within_3_days
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND closed_within_3_days_pct IS NOT NULL
      `;
      const threeDaysResult = await sql(threeDaysQuery);
      results.threeDays = threeDaysResult[0] || { avg_closed_within_3_days: 0 };
      console.log('✅ 3-day closure KPI result:', results.threeDays);
    } catch (error) {
      console.error('❌ 3-day closure KPI query failed:', error);
      results.threeDays = { avg_closed_within_3_days: 0 };
    }

    try {
      // ✅ FIXED: Dynamic 8-week closure rate (no longer hardcoded)
      const eightWeeksQuery = `
        SELECT 
          AVG(CAST(COALESCE(closed_after_3_days_within_8_weeks_pct, 0) AS DECIMAL)) as avg_closed_within_8_weeks
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND closed_after_3_days_within_8_weeks_pct IS NOT NULL
      `;
      const eightWeeksResult = await sql(eightWeeksQuery);
      results.eightWeeks = eightWeeksResult[0] || { avg_closed_within_8_weeks: 0 };
      console.log('✅ 8-week closure KPI result (dynamic):', results.eightWeeks);
    } catch (error) {
      console.error('❌ 8-weeks KPI query failed:', error);
      results.eightWeeks = { avg_closed_within_8_weeks: 0 };
    }

    try {
      // 3.3 Sector uphold averages
      const sectorUpholdQuery = `
        SELECT 
          product_category,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
          COUNT(*) as record_count
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY product_category
      `;
      const sectorUpholdResult = await sql(sectorUpholdQuery);
      results.sectorUphold = sectorUpholdResult || [];
      console.log('✅ Sector uphold results:', results.sectorUphold);
    } catch (error) {
      console.error('❌ Sector uphold query failed:', error);
      results.sectorUphold = [];
    }

    try {
      // 3.4 Sector closure averages
      const sectorClosureQuery = `
        SELECT 
          product_category,
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY product_category
      `;
      const sectorClosureResult = await sql(sectorClosureQuery);
      results.sectorClosure = sectorClosureResult || [];
    } catch (error) {
      console.error('❌ Sector closure query failed:', error);
      results.sectorClosure = [];
    }

    try {
      // ✅ FIX: Top performers - ensure minimum uphold rate > 0%
      const topPerformersQuery = `
        SELECT 
          firm_name,
          COUNT(*) as complaint_count,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND upheld_rate_pct > 0
        GROUP BY firm_name
        HAVING COUNT(*) > 0 
          AND AVG(CAST(upheld_rate_pct AS DECIMAL)) IS NOT NULL
          AND AVG(CAST(upheld_rate_pct AS DECIMAL)) > 0
        ORDER BY avg_uphold_rate ASC
        LIMIT 50
      `;
      const topPerformersResult = await sql(topPerformersQuery);
      results.topPerformers = topPerformersResult || [];
      console.log('✅ Top performers (first 3):', results.topPerformers.slice(0, 3));
    } catch (error) {
      console.error('❌ Top performers query failed:', error);
      results.topPerformers = [];
    }

    try {
      // 3.6 Product categories
      const productCategoriesQuery = `
        SELECT 
          product_category as category_name,
          COUNT(*) as complaint_count,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY COUNT(*) DESC
      `;
      const productCategoriesResult = await sql(productCategoriesQuery);
      results.productCategories = productCategoriesResult || [];
      console.log('✅ Product categories found:', results.productCategories.map((p: any) => `${p.category_name} (${p.complaint_count} records)`));
    } catch (error) {
      console.error('❌ Product categories query failed:', error);
      results.productCategories = [];
    }

    try {
      // 3.7 Industry comparison  
      const industryComparisonQuery = `
        SELECT 
          firm_name,
          COUNT(*) as complaint_count,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
        GROUP BY firm_name
        HAVING COUNT(*) >= 1
          AND AVG(CAST(upheld_rate_pct AS DECIMAL)) > 0
        ORDER BY firm_name ASC
      `;
      const industryComparisonResult = await sql(industryComparisonQuery);
      results.industryComparison = industryComparisonResult || [];
    } catch (error) {
      console.error('❌ Industry comparison query failed:', error);
      results.industryComparison = [];
    }

    try {
      // 3.8 All firms
      const allFirmsQuery = `
        SELECT DISTINCT firm_name
        FROM complaint_metrics_staging 
        WHERE firm_name IS NOT NULL 
          AND firm_name != ''
          AND upheld_rate_pct > 0
        ORDER BY firm_name ASC
      `;
      const allFirmsResult = await sql(allFirmsQuery);
      results.allFirms = allFirmsResult || [];
    } catch (error) {
      console.error('❌ All firms query failed:', error);
      results.allFirms = [];
    }

    try {
      // 3.9 Consumer Credit (keep existing logic)
      console.log('📊 Executing consumer credit query...');
      
      let ccWhereConditions = ["1=1"];
      
      if (filters.years.length > 0) {
        const yearConditions = filters.years.map(year => 
          `(rp.period_start LIKE '%${year}%' OR rp.period_end LIKE '%${year}%')`
        );
        ccWhereConditions.push(`(${yearConditions.join(' OR ')})`);
      }
      
      if (filters.firms.length > 0) {
        const firmConditions = filters.firms.map(firm => 
          `f.name = '${firm.replace(/'/g,"''")}'`
        );
        ccWhereConditions.push(`(${firmConditions.join(' OR ')})`);
      }
      
      const ccWhereClause = ccWhereConditions.join(' AND ');
      
      const consumerCreditQuery = `
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
          AND AVG(cc.complaints_upheld_pct) > 0
        ORDER BY total_received DESC
      `;
      const consumerCreditResult = await sql(consumerCreditQuery);
      results.consumerCredit = consumerCreditResult || [];
      console.log('✅ Consumer credit query successful:', results.consumerCredit.length + ' firms');
    } catch (error) {
      console.error('❌ Consumer credit query failed:', error);
      results.consumerCredit = [];
    }

    // Historical trends and industry trends (keep existing logic)
    try {
      const historicalTrendsQuery = `
        SELECT 
          firm_name,
          reporting_period,
          product_category,
          upheld_rate_pct as upheld_rate,
          closed_within_3_days_pct as closure_rate_3_days,
          closed_after_3_days_within_8_weeks_pct as closure_rate_8_weeks,
          CASE 
            WHEN reporting_period LIKE '%2020%' THEN '2020'
            WHEN reporting_period LIKE '%2021%' THEN '2021'
            WHEN reporting_period LIKE '%2022%' THEN '2022'
            WHEN reporting_period LIKE '%2023%' THEN '2023'
            WHEN reporting_period LIKE '%2024%' THEN '2024'
            ELSE 'Unknown'
          END as trend_year
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND reporting_period NOT LIKE '%Unknown%'
        ORDER BY firm_name, reporting_period
      `;
      const historicalTrendsResult = await sql(historicalTrendsQuery);
      results.historicalTrends = historicalTrendsResult || [];
    } catch (error) {
      console.error('❌ Historical trends query failed:', error);
      results.historicalTrends = [];
    }

    try {
      const industryTrendsQuery = `
        SELECT 
          CASE 
            WHEN reporting_period LIKE '%2020%' THEN '2020'
            WHEN reporting_period LIKE '%2021%' THEN '2021'
            WHEN reporting_period LIKE '%2022%' THEN '2022'
            WHEN reporting_period LIKE '%2023%' THEN '2023'
            WHEN reporting_period LIKE '%2024%' THEN '2024'
            ELSE 'Unknown'
          END as period,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_upheld_rate,
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_rate,
          COUNT(DISTINCT firm_name) as firm_count,
          COUNT(*) as total_records
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND reporting_period NOT LIKE '%Unknown%'
        GROUP BY 
          CASE 
            WHEN reporting_period LIKE '%2020%' THEN '2020'
            WHEN reporting_period LIKE '%2021%' THEN '2021'
            WHEN reporting_period LIKE '%2022%' THEN '2022'
            WHEN reporting_period LIKE '%2023%' THEN '2023'
            WHEN reporting_period LIKE '%2024%' THEN '2024'
            ELSE 'Unknown'
          END
        HAVING 
          CASE 
            WHEN reporting_period LIKE '%2020%' THEN '2020'
            WHEN reporting_period LIKE '%2021%' THEN '2021'
            WHEN reporting_period LIKE '%2022%' THEN '2022'
            WHEN reporting_period LIKE '%2023%' THEN '2023'
            WHEN reporting_period LIKE '%2024%' THEN '2024'
            ELSE 'Unknown'
          END != 'Unknown'
        ORDER BY period DESC
      `;
      const industryTrendsResult = await sql(industryTrendsQuery);
      results.industryTrends = industryTrendsResult || [];
    } catch (error) {
      console.error('❌ Industry trends query failed:', error);
      results.industryTrends = [];
    }

    // 4) Build sector averages objects
    const sectorUpholdAverages: {[key: string]: number} = {};
    (results.sectorUphold || []).forEach((row: any) => {
      if (row.product_category && row.avg_uphold_rate !== null) {
        sectorUpholdAverages[row.product_category] = safeNumber(row.avg_uphold_rate);
      }
    });

    const sectorClosureAverages: {[key: string]: number} = {};
    (results.sectorClosure || []).forEach((row: any) => {
      if (row.product_category && row.avg_closure_rate !== null) {
        sectorClosureAverages[row.product_category] = safeNumber(row.avg_closure_rate);
      }
    });

    const allSectorAverages: {[key: string]: {uphold_rate: number, complaint_count: number}} = {};
    (results.sectorUphold || []).forEach((row: any) => {
      if (row.product_category && row.avg_uphold_rate !== null) {
        const matchingCount = results.productCategories.find((p: any) => p.category_name === row.product_category);
        allSectorAverages[row.product_category] = {
          uphold_rate: safeNumber(row.avg_uphold_rate),
          complaint_count: matchingCount ? safeInt(matchingCount.complaint_count) : 0
        };
      }
    });

    // 5) Transform response data with enhanced validation
    const transformedData = {
      success: true,
      data: {
        kpis: {
          total_complaints: safeInt(results.kpis?.total_complaints),
          total_firms: safeInt(results.kpis?.total_firms),
          avg_upheld_rate: safeNumber(results.kpis?.avg_upheld_rate),
          avg_percentage_upheld: safeNumber(results.kpis?.avg_upheld_rate),
          avg_closed_within_3_days: safeNumber(results.threeDays?.avg_closed_within_3_days), // ✅ NEW: 3-day closure rate
          avg_closed_within_8_weeks: safeNumber(results.eightWeeks?.avg_closed_within_8_weeks), // ✅ FIXED: Now dynamic
          sector_uphold_averages: sectorUpholdAverages,
          sector_closure_averages: sectorClosureAverages,
          all_sector_averages: allSectorAverages
        },
        topPerformers: (results.topPerformers || []).map((item: any) => ({
          firm_name: item.firm_name,
          avg_uphold_rate: safeNumber(item.avg_uphold_rate),
          avg_closure_rate: Math.min(safeNumber(item.avg_closure_rate), 95),
          complaint_count: safeInt(item.complaint_count)
        })),
        consumerCredit: (results.consumerCredit || []).map((item: any) => ({
          firm_name: item.firm_name,
          total_received: safeInt(item.total_received),
          avg_upheld_pct: safeNumber(item.avg_upheld_pct),
          avg_closure_rate: safeNumber(item.avg_closure_rate),
          period_count: safeInt(item.period_count)
        })),
        productCategories: (results.productCategories || []).map((item: any) => ({
          category_name: item.category_name,
          complaint_count: safeInt(item.complaint_count),
          avg_uphold_rate: safeNumber(item.avg_uphold_rate),
          avg_closure_rate: safeNumber(item.avg_closure_rate)
        })),
        industryComparison: (results.industryComparison || []).map((item: any) => ({
          firm_name: item.firm_name,
          complaint_count: safeInt(item.complaint_count),
          avg_uphold_rate: safeNumber(item.avg_uphold_rate),
          avg_closure_rate: safeNumber(item.avg_closure_rate)
        })),
        allFirms: (results.allFirms || []).map((item: any) => ({
          firm_name: item.firm_name
        })),
        historicalTrends: (results.historicalTrends || []).map((item: any) => ({
          firm_name: item.firm_name,
          reporting_period: item.reporting_period,
          product_category: item.product_category,
          upheld_rate: safeNumber(item.upheld_rate),
          closure_rate_3_days: safeNumber(item.closure_rate_3_days),
          closure_rate_8_weeks: safeNumber(item.closure_rate_8_weeks),
          trend_year: item.trend_year
        })),
        industryTrends: (results.industryTrends || []).map((item: any) => ({
          period: item.period,
          avg_upheld_rate: safeNumber(item.avg_upheld_rate),
          avg_closure_rate: safeNumber(item.avg_closure_rate),
          firm_count: safeInt(item.firm_count),
          total_records: safeInt(item.total_records)
        }))
      },
      debug: {
        dataSource: 'complaint_metrics_staging + consumer_credit_metrics',
        executionTime: `${Date.now() - startTime}ms`,
        appliedFilters: filters,
        recordCounts: {
          topPerformers: results.topPerformers?.length || 0,
          consumerCredit: results.consumerCredit?.length || 0,
          productCategories: results.productCategories?.length || 0,
          industryComparison: results.industryComparison?.length || 0
        },
        newKPIs: {
          avg_closed_within_3_days: safeNumber(results.threeDays?.avg_closed_within_3_days),
          avg_closed_within_8_weeks: safeNumber(results.eightWeeks?.avg_closed_within_8_weeks)
        }
      }
    };

    console.log('✅ API response ready:', transformedData.debug);
    return Response.json(transformedData);

  } catch (error) {
    console.error('❌ Dashboard API Error:', error);
    return Response.json(
      { 
        success: false, 
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}