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

    // ✅ Build dynamic WHERE clause
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

    // ✅ Banking & Credit Cards percentage query
    const bankingPercentageQuery = `
      SELECT 
        AVG(CASE WHEN product_category = 'Banking and credit cards' THEN CAST(upheld_rate_pct AS DECIMAL) ELSE NULL END) as banking_avg_percentage
      FROM complaint_metrics_staging 
      WHERE ${whereClause}
    `;

    // ✅ Sector uphold averages query
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

    // ✅ Sector closure averages query
    const sectorClosureQuery = `
      SELECT 
        product_category,
        AVG(CAST(COALESCE(closed_within_3_days_pct, '0') AS DECIMAL)) as avg_closure_rate
      FROM complaint_metrics_staging 
      WHERE ${whereClause}
        AND product_category IS NOT NULL 
        AND product_category != ''
      GROUP BY product_category
      ORDER BY product_category
    `;

    // ✅ Top Performers Query
    const topPerformersQuery = `
      SELECT 
        firm_name,
        COUNT(*) as complaint_count,
        AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
        AVG(CAST(COALESCE(closed_within_3_days_pct, '0') AS DECIMAL)) as avg_closure_rate
      FROM complaint_metrics_staging 
      WHERE ${whereClause}
      GROUP BY firm_name
      HAVING COUNT(*) > 0 AND AVG(CAST(upheld_rate_pct AS DECIMAL)) IS NOT NULL
      ORDER BY avg_uphold_rate ASC
      LIMIT 50
    `;

    // ✅ Consumer Credit Query
    const consumerCreditQuery = `
      SELECT 
        firm_name,
        COUNT(*) as total_records,
        COUNT(*) as complaint_count,
        COUNT(*) as total_received,
        AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_upheld_pct,
        AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
        AVG(CAST(COALESCE(closed_within_3_days_pct, '0') AS DECIMAL)) as avg_closure_rate
      FROM complaint_metrics_staging 
      WHERE ${whereClause}
        AND (
          product_category ILIKE '%credit%' 
          OR product_category ILIKE '%lending%' 
          OR product_category ILIKE '%banking%'
          OR product_category = 'Banking and credit cards'
        )
      GROUP BY firm_name
      HAVING COUNT(*) > 0
      ORDER BY COUNT(*) DESC
    `;

    // ✅ Product Categories Query
    const productCategoriesQuery = `
      SELECT 
        product_category as category_name,
        COUNT(*) as complaint_count,
        AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
        AVG(CAST(COALESCE(closed_within_3_days_pct, '0') AS DECIMAL)) as avg_closure_rate
      FROM complaint_metrics_staging 
      WHERE ${whereClause}
        AND product_category IS NOT NULL 
        AND product_category != ''
      GROUP BY product_category
      ORDER BY COUNT(*) DESC
    `;

    // ✅ Industry Comparison Query
    const industryComparisonQuery = `
      SELECT 
        firm_name,
        COUNT(*) as complaint_count,
        AVG(CAST(upheld_rate_pct AS DECIMAL)) as avg_uphold_rate,
        AVG(CAST(COALESCE(closed_within_3_days_pct, '0') AS DECIMAL)) as avg_closure_rate
      FROM complaint_metrics_staging 
      WHERE ${whereClause}
      GROUP BY firm_name
      HAVING COUNT(*) >= 1
      ORDER BY firm_name ASC
    `;

    // ✅ All Firms Query
    const allFirmsQuery = `
      SELECT DISTINCT firm_name
      FROM complaint_metrics_staging 
      WHERE firm_name IS NOT NULL 
        AND firm_name != ''
      ORDER BY firm_name ASC
    `;

    // ✅ Execute all queries in parallel
    const [
      kpisResult,
      bankingPercentageResult,
      sectorUpholdResult,
      sectorClosureResult,
      topPerformersResult,
      consumerCreditResult,
      productCategoriesResult,
      industryComparisonResult,
      allFirmsResult
    ] = await Promise.all([
      sql(kpisQuery, queryParams),
      sql(bankingPercentageQuery, queryParams),
      sql(sectorUpholdQuery, queryParams),
      sql(sectorClosureQuery, queryParams),
      sql(topPerformersQuery, queryParams),
      sql(consumerCreditQuery, queryParams),
      sql(productCategoriesQuery, queryParams),
      sql(industryComparisonQuery, queryParams),
      sql(allFirmsQuery)
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
          banking_avg_percentage: parseFloat(bankingPercentageResult[0]?.banking_avg_percentage) || 0,
          sector_uphold_averages: sectorUpholdAverages,
          sector_closure_averages: sectorClosureAverages
        },
        topPerformers: (topPerformersResult || []).map((item: any) => ({
          firm_name: item.firm_name,
          complaint_count: parseInt(item.complaint_count) || 0,
          avg_uphold_rate: parseFloat(item.avg_uphold_rate) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0
        })),
        consumerCredit: (consumerCreditResult || []).map((item: any) => ({
          firm_name: item.firm_name,
          total_records: parseInt(item.total_records) || 0,
          total_received: parseInt(item.total_received) || 0,
          complaint_count: parseInt(item.complaint_count) || 0,
          avg_upheld_pct: parseFloat(item.avg_upheld_pct) || 0,
          avg_uphold_rate: parseFloat(item.avg_uphold_rate) || 0,
          avg_closure_rate: parseFloat(item.avg_closure_rate) || 0
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
          sectorClosure: sectorClosureResult?.length || 0
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
      bankingPercentage: response.data.kpis.banking_avg_percentage,
      sectorCount: Object.keys(response.data.kpis.sector_uphold_averages).length,
      executionTime: response.debug.executionTime
    });

    // ✅ Enhanced logging for consumer credit debugging
    if (response.data.consumerCredit.length > 0) {
      console.log('💳 Consumer Credit Sample:', response.data.consumerCredit.slice(0, 3));
      console.log('💳 Consumer Credit Total Records:', response.data.consumerCredit.reduce((sum: number, f: any) => sum + (f.total_records || 0), 0));
    } else {
      console.log('⚠️ No consumer credit data found with filters:', filters);
      
      // Debug: Check if any banking/credit records exist at all
      const debugCreditQuery = `
        SELECT COUNT(*) as count, product_category
        FROM complaint_metrics_staging 
        WHERE firm_name IS NOT NULL 
          AND (
            product_category ILIKE '%credit%' 
            OR product_category ILIKE '%lending%' 
            OR product_category ILIKE '%banking%'
            OR product_category = 'Banking and credit cards'
          )
        GROUP BY product_category
        ORDER BY count DESC
      `;
      
      try {
        const debugResult = await sql(debugCreditQuery);
        console.log('🔍 Available credit-related categories:', debugResult);
      } catch (debugError) {
        console.log('🔍 Debug query failed:', debugError);
      }
    }

    // ✅ Log top performers for debugging the 0% issue
    if (response.data.topPerformers.length > 0) {
      console.log('🏆 Top Performers Sample:', response.data.topPerformers.slice(0, 3));
    } else {
      console.log('⚠️ No top performers found - this causes the 0% issue');
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
