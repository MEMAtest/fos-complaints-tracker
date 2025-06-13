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
    console.log('🚀 Full API called at:', new Date().toISOString());
    
    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const filters: FilterParams = {
      years: searchParams.get('years')?.split(',').filter(Boolean) || [],
      firms: searchParams.get('firms')?.split(',').filter(Boolean) || [],
      products: searchParams.get('products')?.split(',').filter(Boolean) || []
    };

    console.log('🔍 Request filters:', filters);

    // Build WHERE clause with SQL injection prevention
    let whereConditions = [
      "reporting_period IS NOT NULL",
      "reporting_period != ''",
      "firm_name IS NOT NULL", 
      "firm_name != ''"
    ];

    // Year filtering
    if (filters.years && filters.years.length > 0) {
      const yearConditions = filters.years.map(year => `reporting_period LIKE '%${year.replace(/'/g, "''")}%'`);
      whereConditions.push(`(${yearConditions.join(' OR ')})`);
    }

    // Firm filtering  
    if (filters.firms && filters.firms.length > 0) {
      const firmConditions = filters.firms.map(firm => `firm_name = '${firm.replace(/'/g, "''")}'`);
      whereConditions.push(`(${firmConditions.join(' OR ')})`);
    }

    // Product filtering
    if (filters.products && filters.products.length > 0) {
      const productConditions = filters.products.map(product => `product_category = '${product.replace(/'/g, "''")}'`);
      whereConditions.push(`(${productConditions.join(' OR ')})`);
    }

    const whereClause = whereConditions.join(' AND ');
    console.log('📝 WHERE clause:', whereClause);

    // Execute all queries with proper error handling
    const [
      kpisResult,
      overviewUpheldResult,
      sectorUpholdResult,
      sectorClosureResult,
      allSectorAveragesResult,
      eightWeeksKpiResult,
      topPerformersResult,
      productCategoriesResult,
      industryComparisonResult,
      allFirmsResult,
      consumerCreditResult,
      historicalTrendsResult,
      industryTrendsResult
    ] = await Promise.allSettled([
      // 1. Basic KPIs
      sql`
        SELECT 
          COUNT(*) as total_complaints,
          COUNT(DISTINCT firm_name) as total_firms,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_upheld_rate,
          COUNT(*) as total_rows
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
      `,
      
      // 2. Overview uphold percentage
      sql`
        SELECT 
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_percentage_upheld
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
      `,
      
      // 3. Sector uphold averages
      sql`
        SELECT 
          product_category,
          AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
          AND product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY product_category
      `,
      
      // 4. Sector closure averages
      sql`
        SELECT 
          product_category,
          AVG(CAST(COALESCE(closed_within_3_days_pct, 0) AS DECIMAL)) as avg_closure_rate
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
          AND product_category IS NOT NULL 
          AND product_category != ''
        GROUP BY product_category
        ORDER BY product_category
      `,
      
      // 5. All sector averages for Product Analysis
      sql`
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
      `,
      
      // 6. 8-weeks KPI
      sql`
        SELECT 
          AVG(CAST(COALESCE(closed_after_3_days_within_8_weeks_pct, 0) AS DECIMAL)) as avg_closed_within_8_weeks
        FROM complaint_metrics_staging 
        WHERE ${sql.unsafe(whereClause)}
      `,
      
      // 7. Top Performers
      sql`
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
      `,
      
      // 8. Product Categories
      sql`
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
      `,
      
      // 9. Industry Comparison
      sql`
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
        LIMIT 100
      `,
      
      // 10. All Firms
      sql`
        SELECT DISTINCT firm_name
        FROM complaint_metrics_staging 
        WHERE firm_name IS NOT NULL 
          AND firm_name != ''
        ORDER BY firm_name ASC
      `,
      
      // 11. Consumer Credit (simplified)
      sql`
        SELECT 
          f.name AS firm_name,
          SUM(cc.complaints_received) AS total_received,
          SUM(cc.complaints_closed) AS total_closed,
          ROUND(AVG(cc.complaints_upheld_pct), 2) AS avg_upheld_pct,
          ROUND((SUM(cc.complaints_closed)::decimal / NULLIF(SUM(cc.complaints_received), 0)) * 100, 2) AS avg_closure_rate,
          COUNT(*) as period_count
        FROM consumer_credit_metrics cc
        JOIN firms f ON cc.firm_id = f.id
        JOIN reporting_periods rp ON cc.reporting_period_id = rp.id
        WHERE 1=1
        ${filters.years?.length ? sql.unsafe(`AND (${filters.years.map(year => `(rp.period_start || ' - ' || rp.period_end) LIKE '%${year}%'`).join(' OR ')})`) : sql``}
        ${filters.firms?.length ? sql.unsafe(`AND (${filters.firms.map(firm => `f.name = '${firm.replace(/'/g, "''")}'`).join(' OR ')})`) : sql``}
        GROUP BY f.name
        HAVING SUM(cc.complaints_received) > 0
        ORDER BY total_received DESC
        LIMIT 50
      `,
      
      // 12. Historical Trends (simplified)
      sql`
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
        LIMIT 500
      `,
      
      // 13. Industry Trends
      sql`
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
      `
    ]);

    // Process results with error handling
    const getResult = (result: any) => result.status === 'fulfilled' ? result.value : [];
    
    const kpis = getResult(kpisResult)[0] || {
      total_complaints: 0, total_firms: 0, avg_upheld_rate: 0, total_rows: 0
    };
    
    const overviewUpheld = getResult(overviewUpheldResult)[0] || { avg_percentage_upheld: 0 };
    const eightWeeksKpi = getResult(eightWeeksKpiResult)[0] || { avg_closed_within_8_weeks: 0 };
    
    // Process sector data
    const sectorUpholdAverages: {[key: string]: number} = {};
    getResult(sectorUpholdResult).forEach((row: any) => {
      if (row.product_category && row.avg_uphold_rate !== null) {
        sectorUpholdAverages[row.product_category] = parseFloat(row.avg_uphold_rate) || 0;
      }
    });

    const sectorClosureAverages: {[key: string]: number} = {};
    getResult(sectorClosureResult).forEach((row: any) => {
      if (row.product_category && row.avg_closure_rate !== null) {
        sectorClosureAverages[row.product_category] = parseFloat(row.avg_closure_rate) || 0;
      }
    });

    const allSectorAverages: {[key: string]: {uphold_rate: number, complaint_count: number}} = {};
    getResult(allSectorAveragesResult).forEach((row: any) => {
      if (row.product_category && row.avg_upheld_rate !== null) {
        allSectorAverages[row.product_category] = {
          uphold_rate: parseFloat(row.avg_upheld_rate) || 0,
          complaint_count: parseInt(row.complaint_count) || 0
        };
      }
    });

    const executionTime = Date.now() - startTime;

    // Build complete response
    const response = {
      success: true,
      filters,
      data: {
        kpis: {
          total_complaints: parseInt(kpis.total_complaints) || 0,
          total_closed: parseInt(kpis.total_complaints) || 0,
          total_firms: parseInt(kpis.total_firms) || 0,
          avg_upheld_rate: parseFloat(kpis.avg_upheld_rate) || 0,
          total_rows: parseInt(kpis.total_rows) || 0,
          avg_percentage_upheld: parseFloat(overviewUpheld.avg_percentage_upheld) || 0,
          avg_closed_within_8_weeks: parseFloat(eightWeeksKpi.avg_closed_within_8_weeks) || 0,
          sector_uphold_averages: sectorUpholdAverages,
          sector_closure_averages: sectorClosureAverages,
          all_sector_averages: allSectorAverages
        },
        topPerformers: getResult(topPerformersResult).map((item: any) => ({
          firm_name: item.firm_name,
          complaint_count: parseInt(item.complaint_count) || 0,
          avg_uphold_rate: parseFloat(item.avg_uphold_rate) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0
        })),
        consumerCredit: getResult(consumerCreditResult).map((item: any) => ({
          firm_name: item.firm_name,
          total_received: parseInt(item.total_received) || 0,
          total_closed: parseInt(item.total_closed) || 0,
          avg_upheld_pct: parseFloat(item.avg_upheld_pct) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0,
          period_count: parseInt(item.period_count) || 0
        })),
        productCategories: getResult(productCategoriesResult).map((item: any) => ({
          category_name: item.category_name,
          complaint_count: parseInt(item.complaint_count) || 0,
          avg_uphold_rate: parseFloat(item.avg_uphold_rate) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0
        })),
        industryComparison: getResult(industryComparisonResult).map((item: any) => ({
          firm_name: item.firm_name,
          complaint_count: parseInt(item.complaint_count) || 0,
          avg_uphold_rate: parseFloat(item.avg_uphold_rate) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0
        })),
        allFirms: getResult(allFirmsResult).map((item: any) => ({
          firm_name: item.firm_name
        })),
        historicalTrends: getResult(historicalTrendsResult).map((item: any) => ({
          firm_name: item.firm_name,
          reporting_period: item.reporting_period,
          product_category: item.product_category,
          upheld_rate: parseFloat(item.upheld_rate) || 0,
          closure_rate_3_days: parseFloat(item.closure_rate_3_days) || 0,
          closure_rate_8_weeks: parseFloat(item.closure_rate_8_weeks) || 0,
          trend_year: item.trend_year
        })),
        industryTrends: getResult(industryTrendsResult).map((item: any) => ({
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
        dataSource: 'Neon PostgreSQL - Full API',
        queryCounts: {
          kpis: getResult(kpisResult).length,
          topPerformers: getResult(topPerformersResult).length,
          consumerCredit: getResult(consumerCreditResult).length,
          productCategories: getResult(productCategoriesResult).length,
          industryComparison: getResult(industryComparisonResult).length,
          allFirms: getResult(allFirmsResult).length,
          historicalTrends: getResult(historicalTrendsResult).length,
          industryTrends: getResult(industryTrendsResult).length
        }
      }
    };

    console.log('✅ Full API Response:', {
      totalComplaints: response.data.kpis.total_complaints,
      totalFirms: response.data.kpis.total_firms,
      topPerformers: response.data.topPerformers.length,
      consumerCredit: response.data.consumerCredit.length,
      executionTime: response.debug.executionTime
    });

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Full API Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch dashboard data',
      details: error.message || 'Unknown error',
      debug: {
        executionTime: `${Date.now() - startTime}ms`,
        dataSource: 'Error occurred'
      }
    }, { status: 500 });
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
