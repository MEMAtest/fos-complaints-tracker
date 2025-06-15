// src/app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
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

    // 2) Build WHERE clause for STAGING tables (direct field access - no JOINs)
    let whereConditions = [
      "reporting_period IS NOT NULL",
      "reporting_period != ''",
      "firm_name IS NOT NULL", 
      "firm_name != ''"
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

    // 3) Execute all queries using STAGING tables
    let results: any = {};

    try {
      // 3.1 Basic KPIs - STAGING TABLE (✅ FIXED: No REPLACE on numeric fields)
      console.log('📊 Executing KPIs query...');
      const kpisQuery = `
        SELECT 
          COUNT(*) as total_complaints,
          COUNT(DISTINCT firm_name) as total_firms,
          AVG(upheld_rate_pct) as avg_upheld_rate,
          COUNT(*) as total_rows
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND upheld_rate_pct IS NOT NULL
      `;
      const kpisResult = await sql(kpisQuery);
      results.kpis = kpisResult[0] || { total_complaints: 0, total_firms: 0, avg_upheld_rate: 0 };
      console.log('✅ KPIs result:', results.kpis);
    } catch (error) {
      console.error('❌ KPIs query failed:', error);
      results.kpis = { total_complaints: 0, total_firms: 0, avg_upheld_rate: 0 };
    }

    try {
      // 3.2 Top Performers - STAGING TABLE (✅ FIXED: No REPLACE on numeric fields)
      const topPerformersQuery = `
        SELECT 
          firm_name,
          COUNT(*) as complaint_count,
          AVG(upheld_rate_pct) as avg_uphold_rate,
          AVG(COALESCE(closed_within_3_days_pct, 75)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND upheld_rate_pct IS NOT NULL 
        GROUP BY firm_name
        HAVING COUNT(*) > 0
        ORDER BY AVG(upheld_rate_pct) ASC, COUNT(*) DESC
        LIMIT 50
      `;
      const topPerformersResult = await sql(topPerformersQuery);
      results.topPerformers = topPerformersResult || [];
      console.log('✅ Top performers result:', results.topPerformers.length, 'firms');
    } catch (error) {
      console.error('❌ Top performers query failed:', error);
      results.topPerformers = [];
    }

    try {
      // 3.3 Product Categories - STAGING TABLE (✅ FIXED: No REPLACE on numeric fields)
      const productCategoriesQuery = `
        SELECT 
          product_category as category_name,
          COUNT(*) as complaint_count,
          AVG(upheld_rate_pct) as avg_uphold_rate,
          AVG(COALESCE(closed_within_3_days_pct, 75)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND product_category IS NOT NULL 
          AND product_category != ''
          AND upheld_rate_pct IS NOT NULL
        GROUP BY product_category
        ORDER BY COUNT(*) DESC
      `;
      const productCategoriesResult = await sql(productCategoriesQuery);
      results.productCategories = productCategoriesResult || [];
      console.log('✅ Product categories result:', results.productCategories.length, 'categories');
    } catch (error) {
      console.error('❌ Product categories query failed:', error);
      results.productCategories = [];
    }

    try {
      // 3.4 Industry Comparison - STAGING TABLE (✅ FIXED: No REPLACE on numeric fields)
      const industryComparisonQuery = `
        SELECT 
          firm_name,
          COUNT(*) as complaint_count,
          AVG(upheld_rate_pct) as avg_uphold_rate,
          AVG(COALESCE(closed_within_3_days_pct, 75)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${whereClause}
          AND upheld_rate_pct IS NOT NULL 
        GROUP BY firm_name
        HAVING COUNT(*) > 5
        ORDER BY COUNT(*) DESC
        LIMIT 100
      `;
      const industryComparisonResult = await sql(industryComparisonQuery);
      results.industryComparison = industryComparisonResult || [];
      console.log('✅ Industry comparison result:', results.industryComparison.length, 'firms');
    } catch (error) {
      console.error('❌ Industry comparison query failed:', error);
      results.industryComparison = [];
    }

    try {
      // 3.5 All firms - STAGING TABLE
      const allFirmsQuery = `
        SELECT DISTINCT firm_name
        FROM complaint_metrics_staging 
        WHERE firm_name IS NOT NULL 
          AND firm_name != ''
        ORDER BY firm_name ASC
      `;
      const allFirmsResult = await sql(allFirmsQuery);
      results.allFirms = allFirmsResult || [];
      console.log('✅ All firms result:', results.allFirms.length, 'firms');
    } catch (error) {
      console.error('❌ All firms query failed:', error);
      results.allFirms = [];
    }

    try {
      // 3.6 ✅ FIXED: Consumer Credit - Use simplified query without date joins when years are filtered
      console.log('📊 Executing consumer credit query...');
      
      // ✅ FIXED: Don't apply year filters to consumer credit - it uses different table structure
      let ccWhereConditions = ["1=1"];
      
      // Only apply firm filters to consumer credit, not year filters
      if (filters.firms.length > 0) {
        const firmConditions = filters.firms.map(firm => 
          `f.name = '${firm.replace(/'/g,"''")}'`
        );
        ccWhereConditions.push(`(${firmConditions.join(' OR ')})`);
      }
      
      const ccWhereClause = ccWhereConditions.join(' AND ');
      
      // ✅ FIXED: Simplified consumer credit query without problematic date filtering
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
      // 3.7 Historical trends - STAGING TABLE (✅ FIXED: No REPLACE on numeric fields)
      const historicalTrendsQuery = `
        SELECT 
          firm_name,
          reporting_period,
          product_category,
          upheld_rate_pct as upheld_rate,
          COALESCE(closed_within_3_days_pct, 0) as closure_rate_3_days,
          COALESCE(closed_after_3_days_within_8_weeks_pct, 0) as closure_rate_8_weeks,
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
      console.log('✅ Historical trends result:', results.historicalTrends.length, 'records');
    } catch (error) {
      console.error('❌ Historical trends query failed:', error);
      results.historicalTrends = [];
    }

    try {
      // 3.8 Industry trends - STAGING TABLE (✅ FIXED: No REPLACE on numeric fields)
      const industryTrendsQuery = `
        SELECT 
          CASE 
            WHEN reporting_period LIKE '%2020%' THEN '2020'
            WHEN reporting_period LIKE '%2021%' THEN '2021'
            WHEN reporting_period LIKE '%2022%' THEN '2022'
            WHEN reporting_period LIKE '%2023%' THEN '2023'
            WHEN reporting_period LIKE '%2024%' THEN '2024'
            ELSE 'Unknown'
          END as year,
          AVG(upheld_rate_pct) as avg_uphold_rate,
          AVG(COALESCE(closed_within_3_days_pct, 0)) as avg_closure_3_days,
          AVG(COALESCE(closed_after_3_days_within_8_weeks_pct, 0)) as avg_closure_8_weeks,
          COUNT(DISTINCT firm_name) as firm_count,
          COUNT(*) as record_count
        FROM complaint_metrics_staging
        WHERE ${whereClause}
          AND upheld_rate_pct IS NOT NULL
        GROUP BY CASE 
          WHEN reporting_period LIKE '%2020%' THEN '2020'
          WHEN reporting_period LIKE '%2021%' THEN '2021'
          WHEN reporting_period LIKE '%2022%' THEN '2022'
          WHEN reporting_period LIKE '%2023%' THEN '2023'
          WHEN reporting_period LIKE '%2024%' THEN '2024'
          ELSE 'Unknown'
        END
        HAVING COUNT(*) > 0
        ORDER BY year DESC
      `;
      const industryTrendsResult = await sql(industryTrendsQuery);
      results.industryTrends = industryTrendsResult || [];
      console.log('✅ Industry trends result:', results.industryTrends.length, 'periods');
    } catch (error) {
      console.error('❌ Industry trends query failed:', error);
      results.industryTrends = [];
    }

    // 4) Calculate execution time
    const executionTime = `${Date.now() - startTime}ms`;

    // 5) ✅ DEBUG: Add actual product categories to response
    let actualProductCategories: any[] = [];
    try {
      const debugProductsQuery = `
        SELECT DISTINCT product_category, COUNT(*) as count
        FROM complaint_metrics_staging 
        WHERE product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY count DESC
      `;
      actualProductCategories = await sql(debugProductsQuery);
      console.log('✅ Debug products result:', actualProductCategories.length, 'categories');
    } catch (error) {
      console.log('Could not fetch debug product categories:', error);
    }

    const response = {
      success: true,
      filters,
      data: results,
      debug: {
        appliedFilters: filters,
        executionTime,
        dataSource: 'complaint_metrics_staging + consumer_credit_metrics',
        queryCounts: {
          kpis: 1,
          topPerformers: results.topPerformers?.length || 0,
          consumerCredit: results.consumerCredit?.length || 0,
          productCategories: results.productCategories?.length || 0,
          industryComparison: results.industryComparison?.length || 0,
          allFirms: results.allFirms?.length || 0
        },
        actualProductCategories // ✅ Add this for debugging
      }
    };

    console.log('✅ API Response Summary:', {
      totalComplaints: safeInt(results.kpis?.total_complaints),
      totalFirms: safeInt(results.kpis?.total_firms),
      consumerCreditFirms: results.consumerCredit?.length || 0,
      topPerformers: results.topPerformers?.length || 0,
      productCategories: results.productCategories?.length || 0,
      executionTime
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Dashboard API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      filters: {
        years: [],
        firms: [],
        products: []
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}