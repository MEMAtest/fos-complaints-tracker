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
    console.log('🚀 API Dashboard called at:', new Date().toISOString());
    
    const { searchParams } = new URL(request.url);
    
    // ✅ SIMPLIFIED: Parse filters with better validation
    const filters: FilterParams = {
      years: searchParams.get('years')?.split(',').filter(Boolean) || [],
      firms: searchParams.get('firms')?.split(',').filter(Boolean) || [],
      products: searchParams.get('products')?.split(',').filter(Boolean) || []
    };

    console.log('🔍 Request filters:', filters);

    // ✅ SIMPLIFIED: Build WHERE clause without complex parameterization
    let whereConditions = [
      "reporting_period IS NOT NULL",
      "reporting_period != ''",
      "firm_name IS NOT NULL", 
      "firm_name != ''"
    ];

    // Year filtering - simplified approach
    if (filters.years && filters.years.length > 0) {
      const yearConditions = filters.years.map(year => `reporting_period LIKE '%${year}%'`);
      whereConditions.push(`(${yearConditions.join(' OR ')})`);
    }

    // Firm filtering - simplified approach  
    if (filters.firms && filters.firms.length > 0) {
      const firmConditions = filters.firms.map(firm => `firm_name = '${firm.replace(/'/g, "''")}'`);
      whereConditions.push(`(${firmConditions.join(' OR ')})`);
    }

    // Product filtering - simplified approach
    if (filters.products && filters.products.length > 0) {
      const productConditions = filters.products.map(product => `product_category = '${product.replace(/'/g, "''")}'`);
      whereConditions.push(`(${productConditions.join(' OR ')})`);
    }

    const whereClause = whereConditions.join(' AND ');
    console.log('📝 SQL WHERE clause:', whereClause);

    // ✅ STEP-BY-STEP: Execute queries individually with error handling
    let kpisResult, overviewUpheldResult, sectorUpholdResult, sectorClosureResult;
    let eightWeeksKpiResult, topPerformersResult, productCategoriesResult;
    let industryComparisonResult, allFirmsResult, consumerCreditResult;
    let historicalTrendsResult, industryTrendsResult, allSectorAveragesResult;

    try {
      // 1. Basic KPIs
      console.log('📊 Executing KPIs query...');
      kpisResult = await sql`
        SELECT 
          COUNT(*) as total_complaints,
          COUNT(DISTINCT firm_name) as total_firms,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_upheld_rate,
          COUNT(*) as total_rows
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
      `;
      console.log('✅ KPIs query successful:', kpisResult?.length);
    } catch (error) {
      console.error('❌ KPIs query failed:', error);
      kpisResult = [{ total_complaints: 0, total_firms: 0, avg_upheld_rate: 0, total_rows: 0 }];
    }

    try {
      // 2. Overview uphold percentage
      console.log('📊 Executing overview uphold query...');
      overviewUpheldResult = await sql`
        SELECT 
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_percentage_upheld
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
      `;
      console.log('✅ Overview uphold query successful');
    } catch (error) {
      console.error('❌ Overview uphold query failed:', error);
      overviewUpheldResult = [{ avg_percentage_upheld: 0 }];
    }

    try {
      // 3. 8-weeks KPI
      console.log('📊 Executing 8-weeks KPI query...');
      eightWeeksKpiResult = await sql`
        SELECT 
          AVG(CAST(COALESCE(closed_after_3_days_within_8_weeks_pct, 0) AS DECIMAL)) as avg_closed_within_8_weeks
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
      `;
      console.log('✅ 8-weeks KPI query successful');
    } catch (error) {
      console.error('❌ 8-weeks KPI query failed:', error);
      eightWeeksKpiResult = [{ avg_closed_within_8_weeks: 0 }];
    }

    try {
      // 4. Sector uphold averages
      console.log('📊 Executing sector uphold query...');
      sectorUpholdResult = await sql`
        SELECT 
          product_category,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
          AND product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY product_category
      `;
      console.log('✅ Sector uphold query successful:', sectorUpholdResult?.length);
    } catch (error) {
      console.error('❌ Sector uphold query failed:', error);
      sectorUpholdResult = [];
    }

    try {
      // 5. Sector closure averages
      console.log('📊 Executing sector closure query...');
      sectorClosureResult = await sql`
        SELECT 
          product_category,
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
          AND product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY product_category
      `;
      console.log('✅ Sector closure query successful:', sectorClosureResult?.length);
    } catch (error) {
      console.error('❌ Sector closure query failed:', error);
      sectorClosureResult = [];
    }

    try {
      // 6. All sector averages for Product Analysis
      console.log('📊 Executing all sector averages query...');
      allSectorAveragesResult = await sql`
        SELECT 
          product_category,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_upheld_rate,
          COUNT(*) as complaint_count
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
          AND product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY product_category
      `;
      console.log('✅ All sector averages query successful:', allSectorAveragesResult?.length);
    } catch (error) {
      console.error('❌ All sector averages query failed:', error);
      allSectorAveragesResult = [];
    }

    try {
      // 7. Top Performers
      console.log('📊 Executing top performers query...');
      topPerformersResult = await sql`
        SELECT 
          firm_name,
          COUNT(*) as complaint_count,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
        GROUP BY firm_name
        HAVING COUNT(*) > 0 AND AVG(CAST(upheld_rate_pct AS DECIMAL)) IS NOT NULL
        ORDER BY avg_uphold_rate ASC
        LIMIT 50
      `;
      console.log('✅ Top performers query successful:', topPerformersResult?.length);
    } catch (error) {
      console.error('❌ Top performers query failed:', error);
      topPerformersResult = [];
    }

    try {
      // 8. Product Categories
      console.log('📊 Executing product categories query...');
      productCategoriesResult = await sql`
        SELECT 
          product_category as category_name,
          COUNT(*) as complaint_count,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
          AND product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY COUNT(*) DESC
      `;
      console.log('✅ Product categories query successful:', productCategoriesResult?.length);
    } catch (error) {
      console.error('❌ Product categories query failed:', error);
      productCategoriesResult = [];
    }

    try {
      // 9. Industry Comparison
      console.log('📊 Executing industry comparison query...');
      industryComparisonResult = await sql`
        SELECT 
          firm_name,
          COUNT(*) as complaint_count,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
        GROUP BY firm_name
        HAVING COUNT(*) >= 1
        ORDER BY firm_name ASC
      `;
      console.log('✅ Industry comparison query successful:', industryComparisonResult?.length);
    } catch (error) {
      console.error('❌ Industry comparison query failed:', error);
      industryComparisonResult = [];
    }

    try {
      // 10. All Firms
      console.log('📊 Executing all firms query...');
      allFirmsResult = await sql`
        SELECT DISTINCT firm_name
        FROM complaint_metrics_staging 
        WHERE firm_name IS NOT NULL 
          AND firm_name != ''
        ORDER BY firm_name ASC
      `;
      console.log('✅ All firms query successful:', allFirmsResult?.length);
    } catch (error) {
      console.error('❌ All firms query failed:', error);
      allFirmsResult = [];
    }

    try {
      // 11. ✅ SIMPLIFIED: Consumer Credit Query
      console.log('📊 Executing consumer credit query...');
      
      // Build consumer credit WHERE clause separately
      let ccWhereConditions = ["1=1"];
      
      if (filters.years && filters.years.length > 0) {
        const yearConditions = filters.years.map(year => `(rp.period_start || ' - ' || rp.period_end) LIKE '%${year}%'`);
        ccWhereConditions.push(`(${yearConditions.join(' OR ')})`);
      }
      
      if (filters.firms && filters.firms.length > 0) {
        const firmConditions = filters.firms.map(firm => `f.name = '${firm.replace(/'/g, "''")}'`);
        ccWhereConditions.push(`(${firmConditions.join(' OR ')})`);
      }
      
      const ccWhereClause = ccWhereConditions.join(' AND ');
      
      consumerCreditResult = await sql`
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
        WHERE ${sql.unsafe(ccWhereClause)}
        GROUP BY f.name
        HAVING SUM(cc.complaints_received) > 0
        ORDER BY total_received DESC
      `;
      console.log('✅ Consumer credit query successful:', consumerCreditResult?.length);
    } catch (error) {
      console.error('❌ Consumer credit query failed:', error);
      consumerCreditResult = [];
    }

    try {
      // 12. Historical Trends
      console.log('📊 Executing historical trends query...');
      historicalTrendsResult = await sql`
        SELECT 
          cm.firm_name,
          cm.reporting_period,
          cm.product_category,
          CAST(cm.upheld_rate_pct AS DECIMAL) as upheld_rate,
          CAST(COALESCE(cm.closed_within_3_days_pct, 0) AS DECIMAL) as closure_rate_3_days,
          CAST(COALESCE(cm.closed_after_3_days_within_8_weeks_pct, 0) AS DECIMAL) as closure_rate_8_weeks,
          CASE 
            WHEN cm.reporting_period LIKE '%2020%' THEN '2020'
            WHEN cm.reporting_period LIKE '%2021%' THEN '2021'
            WHEN cm.reporting_period LIKE '%2022%' THEN '2022'
            WHEN cm.reporting_period LIKE '%2023%' THEN '2023'
            WHEN cm.reporting_period LIKE '%2024%' THEN '2024'
            ELSE 'Unknown'
          END as trend_year
        FROM complaint_metrics_staging cm
        WHERE ${sql.unsafe(whereClause)}
          AND cm.upheld_rate_pct IS NOT NULL
          AND cm.reporting_period IS NOT NULL
        ORDER BY cm.firm_name, cm.reporting_period
        LIMIT 1000
      `;
      console.log('✅ Historical trends query successful:', historicalTrendsResult?.length);
    } catch (error) {
      console.error('❌ Historical trends query failed:', error);
      historicalTrendsResult = [];
    }

    try {
      // 13. Industry Trends
      console.log('📊 Executing industry trends query...');
      industryTrendsResult = await sql`
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
        WHERE ${sql.unsafe(whereClause)}
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
      console.log('✅ Industry trends query successful:', industryTrendsResult?.length);
    } catch (error) {
      console.error('❌ Industry trends query failed:', error);
      industryTrendsResult = [];
    }

    // ✅ ROBUST: Process sector averages with error handling
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

    // ✅ ROBUST: Build response with fallbacks
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
          total_complaints: parseInt(baseKpis.total_complaints) || 0,
          total_closed: parseInt(baseKpis.total_complaints) || 0,
          total_firms: parseInt(baseKpis.total_firms) || 0,
          avg_upheld_rate: parseFloat(baseKpis.avg_upheld_rate) || 0,
          total_rows: parseInt(baseKpis.total_rows) || 0,
          avg_percentage_upheld: parseFloat(overviewUpheldResult?.[0]?.avg_percentage_upheld) || 0,
          avg_closed_within_8_weeks: parseFloat(eightWeeksKpiResult?.[0]?.avg_closed_within_8_weeks) || 0,
          sector_uphold_averages: sectorUpholdAverages,
          sector_closure_averages: sectorClosureAverages,
          all_sector_averages: allSectorAverages
        },
        topPerformers: (topPerformersResult || []).map((item: any) => ({
          firm_name: item.firm_name,
          complaint_count: parseInt(item.complaint_count) || 0,
          avg_uphold_rate: parseFloat(item.avg_uphold_rate) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0
        })),
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
        historicalTrends: (historicalTrendsResult || []).map((item: any) => ({
          firm_name: item.firm_name,
          reporting_period: item.reporting_period,
          product_category: item.product_category,
          upheld_rate: parseFloat(item.upheld_rate) || 0,
          closure_rate_3_days: parseFloat(item.closure_rate_3_days) || 0,
          closure_rate_8_weeks: parseFloat(item.closure_rate_8_weeks) || 0,
          trend_year: item.trend_year
        })),
        industryTrends: (industryTrendsResult || []).map((item: any) => ({
          period: item.period,
          avg_upheld_rate: parseFloat(item.avg_upheld_rate) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0,
          firm_count: parseInt(item.firm_count) || 0,
          record_count: parseInt(item.record_count) || 0
        }))
      },
      debug: {
        appliedFilters: filters,
        executionTime: `${executionTime}ms`,
        dataSource: 'Neon PostgreSQL - Robust',
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
