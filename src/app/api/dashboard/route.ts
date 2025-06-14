// src/app/api/dashboard/route.ts - FIXED VERSION

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface FilterParams {
  years: string[];
  firms: string[];
  products: string[];
}

// Helper to safely convert database values to numbers
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

    // 2) Build WHERE clause for STAGING tables (no JOINs needed) - SAFER VERSION
    let whereConditions = [
      "reporting_period IS NOT NULL",
      "reporting_period != ''",
      "firm_name IS NOT NULL", 
      "firm_name != ''"
    ];

    // Year filtering - direct field access (safer)
    if (filters.years.length > 0) {
      const safeyears = filters.years.filter(year => /^\d{4}$/.test(year)); // Only 4-digit years
      if (safeyears.length > 0) {
        const yearConditions = safeyears.map(year => 
          `reporting_period LIKE '%${year}%'`
        );
        whereConditions.push(`(${yearConditions.join(' OR ')})`);
      }
    }

    // Firm filtering - direct field access (safer)
    if (filters.firms.length > 0) {
      const safeFirms = filters.firms.filter(firm => firm && firm.length > 0);
      if (safeFirms.length > 0) {
        const firmConditions = safeFirms.map(firm => 
          `firm_name = '${firm.replace(/'/g, "''")}'`
        );
        whereConditions.push(`(${firmConditions.join(' OR ')})`);
      }
    }

    // Product filtering - direct field access (safer)
    if (filters.products.length > 0) {
      const safeProducts = filters.products.filter(product => product && product.length > 0);
      if (safeProducts.length > 0) {
        const productConditions = safeProducts.map(product => 
          `product_category = '${product.replace(/'/g, "''")}'`
        );
        whereConditions.push(`(${productConditions.join(' OR ')})`);
      }
    }

    const whereClause = whereConditions.join(' AND ');
    console.log('📝 SQL WHERE clause:', whereClause);

    // 3) Execute all queries using STAGING tables
    let results: any = {};

    try {
      // 3.1 Basic KPIs - STAGING TABLE
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
      console.log('✅ KPIs query successful:', results.kpis);
    } catch (error) {
      console.error('❌ KPIs query failed:', error);
      results.kpis = { total_complaints: 0, total_firms: 0, avg_upheld_rate: 0, total_rows: 0 };
    }

    try {
      // 3.2 8-weeks KPI - STAGING TABLE
      const eightWeeksQuery = `
        SELECT 
          AVG(CAST(COALESCE(closed_after_3_days_within_8_weeks_pct, 0) AS DECIMAL)) as avg_closed_within_8_weeks
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
      `;
      const eightWeeksResult = await sql(eightWeeksQuery);
      results.eightWeeks = eightWeeksResult[0] || { avg_closed_within_8_weeks: 0 };
    } catch (error) {
      console.error('❌ 8-weeks KPI query failed:', error);
      results.eightWeeks = { avg_closed_within_8_weeks: 0 };
    }

    try {
      // 3.3 Sector uphold averages - STAGING TABLE
      const sectorUpholdQuery = `
        SELECT 
          product_category,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY product_category
      `;
      const sectorUpholdResult = await sql(sectorUpholdQuery);
      results.sectorUphold = sectorUpholdResult || [];
    } catch (error) {
      console.error('❌ Sector uphold query failed:', error);
      results.sectorUphold = [];
    }

    try {
      // 3.4 Sector closure averages - STAGING TABLE
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
      // 3.5 Top performers - STAGING TABLE
      const topPerformersQuery = `
        SELECT 
          firm_name,
          COUNT(*) as complaint_count,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
        GROUP BY firm_name
        HAVING COUNT(*) > 0 AND AVG(CAST(upheld_rate_pct AS DECIMAL)) IS NOT NULL
        ORDER BY avg_uphold_rate ASC
        LIMIT 50
      `;
      const topPerformersResult = await sql(topPerformersQuery);
      results.topPerformers = topPerformersResult || [];
    } catch (error) {
      console.error('❌ Top performers query failed:', error);
      results.topPerformers = [];
    }

    try {
      // 3.6 Product categories - STAGING TABLE
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
    } catch (error) {
      console.error('❌ Product categories query failed:', error);
      results.productCategories = [];
    }

    try {
      // 3.7 Industry comparison - STAGING TABLE
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
        ORDER BY firm_name ASC
      `;
      const industryComparisonResult = await sql(industryComparisonQuery);
      results.industryComparison = industryComparisonResult || [];
    } catch (error) {
      console.error('❌ Industry comparison query failed:', error);
      results.industryComparison = [];
    }

    try {
      // 3.8 All firms - STAGING TABLE
      const allFirmsQuery = `
        SELECT DISTINCT firm_name
        FROM complaint_metrics_staging 
        WHERE firm_name IS NOT NULL 
          AND firm_name != ''
        ORDER BY firm_name ASC
      `;
      const allFirmsResult = await sql(allFirmsQuery);
      results.allFirms = allFirmsResult || [];
    } catch (error) {
      console.error('❌ All firms query failed:', error);
      results.allFirms = [];
    }

    try {
      // 3.9 Consumer Credit - KEEP PRODUCTION TABLES (works correctly)
      console.log('📊 Executing consumer credit query...');
      
      let ccWhereConditions = ["1=1"];
      
      // Safer year filtering for consumer credit
      if (filters.years.length > 0) {
        const safeyears = filters.years.filter(year => /^\d{4}$/.test(year));
        if (safeyears.length > 0) {
          const yearConditions = safeyears.map(year => 
            `(rp.period_start LIKE '%${year}%' OR rp.period_end LIKE '%${year}%')`
          );
          ccWhereConditions.push(`(${yearConditions.join(' OR ')})`);
        }
      }
      
      // Safer firm filtering for consumer credit
      if (filters.firms.length > 0) {
        const safeFirms = filters.firms.filter(firm => firm && firm.length > 0);
        if (safeFirms.length > 0) {
          const firmConditions = safeFirms.map(firm => 
            `f.name = '${firm.replace(/'/g,"''")}'`
          );
          ccWhereConditions.push(`(${firmConditions.join(' OR ')})`);
        }
      }
      
      const ccWhereClause = ccWhereConditions.join(' AND ');
      console.log('📝 Consumer Credit WHERE clause:', ccWhereClause);
      
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
        ORDER BY total_received DESC
      `;
      const consumerCreditResult = await sql(consumerCreditQuery);
      results.consumerCredit = consumerCreditResult || [];
      console.log('✅ Consumer credit query successful:', results.consumerCredit.length);
    } catch (error) {
      console.error('❌ Consumer credit query failed:', error);
      results.consumerCredit = [];
    }

    try {
      // 3.10 Historical trends - STAGING TABLE
      const historicalTrendsQuery = `
        SELECT 
          firm_name,
          reporting_period,
          product_category,
          CAST(upheld_rate_pct AS DECIMAL) as upheld_rate,
          CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL) as closure_rate_3_days,
          CAST(COALESCE(closed_after_3_days_within_8_weeks_pct, 0) AS DECIMAL) as closure_rate_8_weeks,
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
          AND upheld_rate_pct IS NOT NULL
          AND reporting_period IS NOT NULL
        ORDER BY firm_name, reporting_period
        LIMIT 1000
      `;
      const historicalTrendsResult = await sql(historicalTrendsQuery);
      results.historicalTrends = historicalTrendsResult || [];
    } catch (error) {
      console.error('❌ Historical trends query failed:', error);
      results.historicalTrends = [];
    }

    try {
      // 3.11 Industry trends - STAGING TABLE
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
          COUNT(*) as record_count
        FROM complaint_metrics_staging
        WHERE ${whereClause}
          AND upheld_rate_pct IS NOT NULL
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
        // Find matching count from a separate query or use current count
        const matchingCount = results.productCategories.find((p: any) => p.category_name === row.product_category);
        allSectorAverages[row.product_category] = {
          uphold_rate: safeNumber(row.avg_uphold_rate),
          complaint_count: matchingCount ? safeInt(matchingCount.complaint_count) : 0
        };
      }
    });

    const executionTime = Date.now() - startTime;

    // 5) Build final response
    const response = {
      success: true,
      filters,
      data: {
        kpis: {
          total_complaints: safeInt(results.kpis.total_complaints),
          total_closed: safeInt(results.kpis.total_complaints), // Same as total_complaints for staging
          total_firms: safeInt(results.kpis.total_firms),
          avg_upheld_rate: safeNumber(results.kpis.avg_upheld_rate),
          total_rows: safeInt(results.kpis.total_rows),
          avg_percentage_upheld: safeNumber(results.kpis.avg_upheld_rate), // Same as avg_upheld_rate
          avg_closed_within_8_weeks: safeNumber(results.eightWeeks.avg_closed_within_8_weeks),
          sector_uphold_averages: sectorUpholdAverages,
          sector_closure_averages: sectorClosureAverages,
          all_sector_averages: allSectorAverages
        },
        topPerformers: (results.topPerformers || []).map((item: any) => ({
          firm_name: item.firm_name,
          complaint_count: safeInt(item.complaint_count),
          avg_uphold_rate: safeNumber(item.avg_uphold_rate),
          avg_closure_rate: safeNumber(item.avg_closure_rate)
        })),
        consumerCredit: (results.consumerCredit || []).map((item: any) => ({
          firm_name: item.firm_name,
          total_received: safeInt(item.total_received),
          total_closed: safeInt(item.total_closed),
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
          record_count: safeInt(item.record_count)
        }))
      },
      debug: {
        appliedFilters: filters,
        executionTime: `${executionTime}ms`,
        dataSource: 'Neon PostgreSQL - Staging Tables',
        queryCounts: {
          kpis: 1,
          topPerformers: results.topPerformers?.length || 0,
          consumerCredit: results.consumerCredit?.length || 0,
          productCategories: results.productCategories?.length || 0,
          industryComparison: results.industryComparison?.length || 0,
          allFirms: results.allFirms?.length || 0,
          sectorUphold: results.sectorUphold?.length || 0,
          sectorClosure: results.sectorClosure?.length || 0,
          historicalTrends: results.historicalTrends?.length || 0,
          industryTrends: results.industryTrends?.length || 0
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

    // Final validation - ensure we have meaningful data
    if (response.data.kpis.total_complaints === 0 && response.data.kpis.total_firms === 0) {
      console.warn('⚠️ Warning: API returning zero data - check database connection and filters');
    }
    
    if (response.data.kpis.total_complaints > 0 && response.data.topPerformers.length === 0) {
      console.warn('⚠️ Warning: Have complaints but no top performers - check queries');
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Dashboard API Critical Error:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          executionTime: `${Date.now() - startTime}ms`,
          dataSource: 'Error occurred',
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          timestamp: new Date().toISOString()
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
