import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface FilterParams {
  years?: string[];
  firms?: string[];
  products?: string[];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    
    // ✅ Parse filters
    const filters: FilterParams = {
      years: searchParams.get('years')?.split(',').filter(Boolean) || [],
      firms: searchParams.get('firms')?.split(',').filter(Boolean) || [],
      products: searchParams.get('products')?.split(',').filter(Boolean) || []
    };

    console.log('🔍 API called with filters:', filters);

    // ✅ Build dynamic WHERE clause for main complaints table
    const whereConditions: string[] = [
      "reporting_period IS NOT NULL",
      "reporting_period != ''",
      "firm_name IS NOT NULL", 
      "firm_name != ''"
    ];

    const queryParams: any[] = [];
    let paramIndex = 1;

    // Year filtering
    if (filters.years && filters.years.length > 0) {
      const yearConditions = filters.years.map(() => {
        return `reporting_period LIKE $${paramIndex++}`;
      });
      whereConditions.push(`(${yearConditions.join(' OR ')})`);
      filters.years.forEach(year => queryParams.push(`%${year}%`));
    }

    // Firm filtering  
    if (filters.firms && filters.firms.length > 0) {
      const firmConditions = filters.firms.map(() => `firm_name = $${paramIndex++}`);
      whereConditions.push(`(${firmConditions.join(' OR ')})`);
      filters.firms.forEach(firm => queryParams.push(firm));
    }

    // Product filtering
    if (filters.products && filters.products.length > 0) {
      const productConditions = filters.products.map(() => `product_category = $${paramIndex++}`);
      whereConditions.push(`(${productConditions.join(' OR ')})`);
      filters.products.forEach(product => queryParams.push(product));
    }

    const whereClause = whereConditions.join(' AND ');

    console.log('📝 SQL WHERE clause:', whereClause);
    console.log('📝 Query params:', queryParams);

    // ✅ FIXED: KPIs Query with correct field names
    const kpisQuery = `
      SELECT 
        COUNT(*) as total_complaints,
        COUNT(DISTINCT firm_name) as total_firms,
        AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_upheld_rate,
        COUNT(*) as total_rows
      FROM complaint_metrics_staging 
      WHERE ${whereClause}
    `;

    // ✅ ENHANCED: Replace Banking percentage with "Average Percentage of Complaints Upheld" for Overview
    const overviewUpheldQuery = `
      SELECT 
        AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_percentage_upheld
      FROM complaint_metrics_staging 
      WHERE ${whereClause}
    `;

    // ✅ NEW: All 5 sector averages for Product Analysis (replaces single banking percentage)
    const allSectorAveragesQuery = `
      SELECT 
        product_category,
        AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_upheld_rate,
        COUNT(*) as complaint_count
      FROM complaint_metrics_staging 
      WHERE ${whereClause}
        AND product_category IS NOT NULL 
        AND product_category != ''
      GROUP BY product_category
      ORDER BY product_category
    `;

    // ✅ Sector uphold averages query (unchanged)
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

    // ✅ Sector closure averages query (unchanged)
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

    // ✅ NEW: 8-weeks KPI calculation
    const eightWeeksKpiQuery = `
      SELECT 
        AVG(CAST(COALESCE(closed_after_3_days_within_8_weeks_pct, 0) AS DECIMAL)) as avg_closed_within_8_weeks
      FROM complaint_metrics_staging 
      WHERE ${whereClause}
    `;

    // ✅ Top Performers Query (unchanged)
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

    // 🚀 FIXED: Consumer Credit Query - Using CORRECT table with proper parameter types
    let consumerCreditQuery = `
      SELECT 
        f.name AS firm_name,
        SUM(cc.complaints_received) AS total_received,
        SUM(cc.complaints_closed) AS total_closed,
        ROUND(AVG(cc.complaints_upheld_pct), 2) AS avg_upheld_pct,
        
        -- Calculate closure rate from actual numbers
        ROUND(
          (SUM(cc.complaints_closed)::decimal / NULLIF(SUM(cc.complaints_received), 0)) * 100, 
          2
        ) AS avg_closure_rate,
        
        COUNT(*) as period_count

      FROM consumer_credit_metrics cc
      JOIN firms f ON cc.firm_id = f.id
      JOIN reporting_periods rp ON cc.reporting_period_id = rp.id

      WHERE 1=1
    `;

    // ✅ Build consumer credit query filters and parameters separately
    const consumerCreditParams: any[] = [];
    let ccParamIndex = 1;

    // Apply year filters
    if (filters.years && filters.years.length > 0) {
      const yearConditions = filters.years.map(() => {
        return `(rp.period_start || ' - ' || rp.period_end) LIKE ${ccParamIndex++}::text`;
      });
      consumerCreditQuery += ` AND (${yearConditions.join(' OR ')})`;
      filters.years.forEach(year => consumerCreditParams.push(`%${year}%`));
    }

    // Apply firm filters
    if (filters.firms && filters.firms.length > 0) {
      const firmConditions = filters.firms.map(() => `f.name = ${ccParamIndex++}::text`);
      consumerCreditQuery += ` AND (${firmConditions.join(' OR ')})`;
      filters.firms.forEach(firm => consumerCreditParams.push(firm));
    }

    
    consumerCreditQuery += `
      GROUP BY f.name
      HAVING SUM(cc.complaints_received) > 0
      ORDER BY total_received DESC
    `;

    // ✅ NEW: Historical trend data for KPI trends and multi-firm comparison
    const historicalTrendsQuery = `
      SELECT 
        cm.firm_name,
        cm.reporting_period,
        cm.product_category,
        CAST(cm.upheld_rate_pct AS DECIMAL) as upheld_rate,
        CAST(COALESCE(cm.closed_within_3_days_pct, 0) AS DECIMAL) as closure_rate_3_days,
        CAST(COALESCE(cm.closed_after_3_days_within_8_weeks_pct, 0) AS DECIMAL) as closure_rate_8_weeks,
        -- Extract year from reporting period for trend analysis
        CASE 
          WHEN cm.reporting_period LIKE '%2018%' THEN '2018'
          WHEN cm.reporting_period LIKE '%2019%' THEN '2019'
          WHEN cm.reporting_period LIKE '%2020%' THEN '2020'
          WHEN cm.reporting_period LIKE '%2021%' THEN '2021'
          WHEN cm.reporting_period LIKE '%2022%' THEN '2022'
          WHEN cm.reporting_period LIKE '%2023%' THEN '2023'
          WHEN cm.reporting_period LIKE '%2024%' THEN '2024'
          ELSE 'Unknown'
        END as trend_year
      FROM complaint_metrics_staging cm
      WHERE ${whereClause}
        AND cm.upheld_rate_pct IS NOT NULL
        AND cm.reporting_period IS NOT NULL
      ORDER BY cm.firm_name, cm.reporting_period
    `;

    // ✅ NEW: Industry trend averages by year for benchmarking
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
        AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
        AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_3_days,
        AVG(CAST(COALESCE(closed_after_3_days_within_8_weeks_pct, 0) AS DECIMAL)) as avg_closure_8_weeks,
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
      ORDER BY year DESC
    `;

    // ✅ Product Categories Query (unchanged)
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

    // ✅ Industry Comparison Query (unchanged)
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

    // ✅ All Firms Query (unchanged)
    const allFirmsQuery = `
      SELECT DISTINCT firm_name
      FROM complaint_metrics_staging 
      WHERE firm_name IS NOT NULL 
        AND firm_name != ''
      ORDER BY firm_name ASC
    `;

    // ✅ Execute all queries in parallel including historical trends
    const [
      kpisResult,
      overviewUpheldResult,
      allSectorAveragesResult,
      sectorUpholdResult,
      sectorClosureResult,
      eightWeeksKpiResult,
      topPerformersResult,
      consumerCreditResult,
      productCategoriesResult,
      industryComparisonResult,
      allFirmsResult,
      historicalTrendsResult,
      industryTrendsResult
    ] = await Promise.all([
      sql(kpisQuery, queryParams),
      sql(overviewUpheldQuery, queryParams),
      sql(allSectorAveragesQuery, queryParams),
      sql(sectorUpholdQuery, queryParams),
      sql(sectorClosureQuery, queryParams),
      sql(eightWeeksKpiQuery, queryParams),
      sql(topPerformersQuery, queryParams),
      sql(consumerCreditQuery, consumerCreditParams), // ✅ Use separate parameters
      sql(productCategoriesQuery, queryParams),
      sql(industryComparisonQuery, queryParams),
      sql(allFirmsQuery),
      sql(historicalTrendsQuery, queryParams), // ✅ NEW: Historical trends
      sql(industryTrendsQuery, queryParams)    // ✅ NEW: Industry trends
    ]);

    // ✅ FIXED: Process sector averages into objects with proper error handling
    const sectorUpholdAverages: {[key: string]: number} = {};
    (sectorUpholdResult || []).forEach((row: any) => {
      if (row.product_category && row.avg_uphold_rate !== null) {
        sectorUpholdAverages[row.product_category] = parseFloat(row.avg_uphold_rate) || 0;
      }
    });

    const sectorClosureAverages: {[key: string]: number} = {};
    (sectorClosureResult || []).forEach((row: any) => {
      if (row.product_category && row.avg_closure_rate !== null) {
        sectorClosureAverages[row.product_category] = parseFloat(row.avg_closure_rate) || 0;
      }
    });

    // ✅ NEW: Process all sector averages for Product Analysis
    const allSectorAverages: {[key: string]: {uphold_rate: number, complaint_count: number}} = {};
    (allSectorAveragesResult || []).forEach((row: any) => {
      if (row.product_category && row.avg_upheld_rate !== null) {
        allSectorAverages[row.product_category] = {
          uphold_rate: parseFloat(row.avg_upheld_rate) || 0,
          complaint_count: parseInt(row.complaint_count) || 0
        };
      }
    });

    const executionTime = Date.now() - startTime;

    // ✅ FIXED: Enhanced response structure matching interface exactly
    const baseKpis = kpisResult[0] || {
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
          total_complaints: parseInt(baseKpis.total_complaints) || 0,
          total_closed: parseInt(baseKpis.total_complaints) || 0,
          total_firms: parseInt(baseKpis.total_firms) || 0,
          avg_upheld_rate: parseFloat(baseKpis.avg_upheld_rate) || 0,
          total_rows: parseInt(baseKpis.total_rows) || 0,
          
          // ✅ NEW: Replace banking percentage with overall average for Overview
          avg_percentage_upheld: parseFloat(overviewUpheldResult[0]?.avg_percentage_upheld) || 0,
          
          // ✅ NEW: 8-weeks KPI
          avg_closed_within_8_weeks: parseFloat(eightWeeksKpiResult[0]?.avg_closed_within_8_weeks) || 0,
          
          // ✅ Keep sector averages for existing functionality
          sector_uphold_averages: sectorUpholdAverages,
          sector_closure_averages: sectorClosureAverages,
          
          // ✅ NEW: All sector averages for Product Analysis tab
          all_sector_averages: allSectorAverages
        },
        topPerformers: (topPerformersResult || []).map((item: any) => ({
          firm_name: item.firm_name,
          complaint_count: parseInt(item.complaint_count) || 0,
          avg_uphold_rate: parseFloat(item.avg_uphold_rate) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0
        })),
        
        // 🚀 FIXED: Consumer Credit with ACTUAL volumes from correct table
        consumerCredit: (consumerCreditResult || []).map((item: any) => ({
          firm_name: item.firm_name,
          total_received: parseInt(item.total_received) || 0,
          total_closed: parseInt(item.total_closed) || 0,
          avg_upheld_pct: parseFloat(item.avg_upheld_pct) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0,
          period_count: parseInt(item.period_count) || 0
        })),
        
        productCategories: (productCategoriesResult || []).map((item: any) => ({
          category_name: item.category_name,
          complaint_count: parseInt(item.complaint_count) || 0,
          avg_uphold_rate: parseFloat(item.avg_uphold_rate) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0
        })),
        industryComparison: (industryComparisonResult || []).map((item: any) => ({
          firm_name: item.firm_name,
          complaint_count: parseInt(item.complaint_count) || 0,
          avg_uphold_rate: parseFloat(item.avg_uphold_rate) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0
        })),
        allFirms: (allFirmsResult || []).map((item: any) => ({
          firm_name: item.firm_name
        })),
        
        // ✅ NEW: Historical trends data for multi-firm comparison and trend analysis
        historicalTrends: (historicalTrendsResult || []).map((item: any) => ({
          firm_name: item.firm_name,
          reporting_period: item.reporting_period,
          product_category: item.product_category,
          upheld_rate: parseFloat(item.upheld_rate) || 0,
          closure_rate_3_days: parseFloat(item.closure_rate_3_days) || 0,
          closure_rate_8_weeks: parseFloat(item.closure_rate_8_weeks) || 0,
          trend_year: item.trend_year
        })),
        
        // ✅ NEW: Industry trend averages for benchmarking
        industryTrends: (industryTrendsResult || []).map((item: any) => ({
          year: item.year,
          avg_uphold_rate: parseFloat(item.avg_uphold_rate) || 0,
          avg_closure_3_days: parseFloat(item.avg_closure_3_days) || 0,
          avg_closure_8_weeks: parseFloat(item.avg_closure_8_weeks) || 0,
          firm_count: parseInt(item.firm_count) || 0,
          record_count: parseInt(item.record_count) || 0
        }))
      },
      debug: {
        appliedFilters: filters,
        executionTime: `${executionTime}ms`,
        dataSource: 'Neon PostgreSQL',
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
          historicalTrends: historicalTrendsResult?.length || 0,    // ✅ NEW
          industryTrends: industryTrendsResult?.length || 0        // ✅ NEW
        },
        sampleData: {
          consumerCredit: (consumerCreditResult || []).slice(0, 2),
          topPerformers: (topPerformersResult || []).slice(0, 2)
        }
      }
    };

    console.log('✅ API Response Summary:', {
      totalComplaints: response.data.kpis.total_complaints,
      totalFirms: response.data.kpis.total_firms,
      consumerCreditFirms: response.data.consumerCredit.length,
      topPerformers: response.data.topPerformers.length,
      avgPercentageUpheld: response.data.kpis.avg_percentage_upheld,
      avgClosedWithin8Weeks: response.data.kpis.avg_closed_within_8_weeks,
      sectorCount: Object.keys(response.data.kpis.sector_uphold_averages).length,
      allSectorCount: Object.keys(response.data.kpis.all_sector_averages).length,
      executionTime: response.debug.executionTime
    });

    // ✅ Enhanced logging for FIXED consumer credit data
    if (response.data.consumerCredit.length > 0) {
      console.log('🚀 FIXED Consumer Credit Sample:', response.data.consumerCredit.slice(0, 3));
      console.log('🚀 FIXED Consumer Credit Total Volume:', response.data.consumerCredit.reduce((sum: number, f: any) => sum + (f.total_received || 0), 0));
      
      // Log Monzo specifically to verify fix
      const monzoData = response.data.consumerCredit.find((f: any) => f.firm_name.toLowerCase().includes('monzo'));
      if (monzoData) {
        console.log('🎯 MONZO FIXED - Volume should now be 6,255+:', monzoData);
      }
    } else {
      console.log('⚠️ No consumer credit data found with filters:', filters);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Dashboard API Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          executionTime: `${Date.now() - startTime}ms`,
          dataSource: 'Error occurred'
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
