import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Type definitions
interface DatabaseConfig {
  connectionString: string;
  ssl?: { rejectUnauthorized: boolean };
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

interface QueryResult {
  rows: any[];
  rowCount: number;
}

interface KPIData {
  total_firms: string;
  total_rows: string;
  avg_upheld_rate: string;
}

interface FirmData {
  firm_name: string;
  complaint_count: string;
  avg_uphold_rate: string;
  avg_resolution_speed?: string;
}

interface ProductData {
  category_name: string;
  complaint_count: string;
  avg_uphold_rate: string;
  avg_resolution_speed?: string;
}

interface ConsumerCreditData {
  firm_name: string;
  total_records: string;
  avg_upheld_pct: string;
  avg_resolution_speed?: string;
}

// Database connection with robust configuration
const createPool = (): Pool => {
  const config: DatabaseConfig = {
    connectionString: process.env.DATABASE_URL || '',
    max: 10, // Maximum number of connections
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 10000, // Connection timeout 10s
  };

  if (process.env.NODE_ENV === 'production') {
    config.ssl = { rejectUnauthorized: false };
  }

  return new Pool(config);
};

const pool = createPool();

// Query timeout wrapper
const executeQueryWithTimeout = async (
  client: any, 
  query: string, 
  params: any[] = [], 
  timeoutMs: number = 15000
): Promise<QueryResult> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    client.query(query, params)
      .then((result: QueryResult) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
};

// Data validation and sanitization functions
const validateNumber = (value: any, defaultValue: number = 0): number => {
  const num = parseFloat(String(value || defaultValue));
  return isNaN(num) ? defaultValue : Math.max(0, num);
};

const validateString = (value: any, maxLength: number = 100): string => {
  return String(value || 'Unknown').substring(0, maxLength).trim();
};

const validatePercentage = (value: any): number => {
  const num = validateNumber(value);
  return Math.min(100, Math.max(0, num));
};

// Fallback data for when database queries fail
const getFallbackData = (error: string) => ({
  success: false,
  error,
  data: {
    kpis: {
      total_complaints: 534037,
      total_firms: 247,
      avg_upheld_rate: 29.8,
      total_rows: 4735
    },
    topPerformers: [
      { 
        firm_name: "Adrian Flux Insurance", 
        complaint_count: 890, 
        avg_uphold_rate: "20.1", 
        avg_resolution_speed: "93.7" 
      },
      { 
        firm_name: "Bank of Scotland plc", 
        complaint_count: 1250, 
        avg_uphold_rate: "43.3", 
        avg_resolution_speed: "63.1" 
      },
      { 
        firm_name: "AJ Bell Securities", 
        complaint_count: 567, 
        avg_uphold_rate: "50.1", 
        avg_resolution_speed: "42.1" 
      },
      { 
        firm_name: "Allianz Insurance Plc", 
        complaint_count: 423, 
        avg_uphold_rate: "57.2", 
        avg_resolution_speed: "38.5" 
      },
      { 
        firm_name: "Aldermore Bank Plc", 
        complaint_count: 345, 
        avg_uphold_rate: "66.2", 
        avg_resolution_speed: "35.8" 
      }
    ],
    productCategories: [
      { 
        category_name: "Banking and credit cards", 
        complaint_count: 2150, 
        avg_uphold_rate: "35.2", 
        avg_resolution_speed: "45.8" 
      },
      { 
        category_name: "Insurance & pure protection", 
        complaint_count: 1340, 
        avg_uphold_rate: "28.1", 
        avg_resolution_speed: "52.3" 
      },
      { 
        category_name: "Home finance", 
        complaint_count: 890, 
        avg_uphold_rate: "42.7", 
        avg_resolution_speed: "38.9" 
      },
      { 
        category_name: "Decumulation & pensions", 
        complaint_count: 567, 
        avg_uphold_rate: "31.4", 
        avg_resolution_speed: "41.2" 
      },
      { 
        category_name: "Investments", 
        complaint_count: 345, 
        avg_uphold_rate: "29.8", 
        avg_resolution_speed: "48.7" 
      }
    ],
    industryComparison: [
      { 
        firm_name: "Adrian Flux Insurance", 
        complaint_count: 890, 
        avg_uphold_rate: "20.1", 
        avg_resolution_speed: "93.7", 
        avg_8week_resolution: "98.2" 
      },
      { 
        firm_name: "Bank of Scotland plc", 
        complaint_count: 1250, 
        avg_uphold_rate: "43.3", 
        avg_resolution_speed: "63.1", 
        avg_8week_resolution: "89.4" 
      },
      { 
        firm_name: "AJ Bell Securities", 
        complaint_count: 567, 
        avg_uphold_rate: "50.1", 
        avg_resolution_speed: "42.1", 
        avg_8week_resolution: "87.3" 
      }
    ],
    consumerCredit: [
      { 
        firm_name: "Black Horse Limited", 
        total_received: 132936, 
        avg_upheld_pct: "48.4", 
        avg_resolution_speed: "35.2" 
      },
      { 
        firm_name: "BMW Financial Services", 
        total_received: 72229, 
        avg_upheld_pct: "12.5", 
        avg_resolution_speed: "78.9" 
      },
      { 
        firm_name: "Close Brothers Limited", 
        total_received: 37646, 
        avg_upheld_pct: "13.8", 
        avg_resolution_speed: "65.4" 
      },
      { 
        firm_name: "Clydesdale Financial", 
        total_received: 26492, 
        avg_upheld_pct: "15.5", 
        avg_resolution_speed: "58.7" 
      },
      { 
        firm_name: "Blue Motor Finance", 
        total_received: 13885, 
        avg_upheld_pct: "13.1", 
        avg_resolution_speed: "72.3" 
      }
    ]
  },
  debug: {
  timestamp: new Date().toISOString(),
  dataSource: 'fallback_data',
  executionTime: '0ms',
  error,
  note: 'Using fallback data due to database error'
}
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let client: any = null;

  try {
    // Get database client with timeout
    client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);

    console.log('✅ Database connected');

    // Test database connectivity
    await executeQueryWithTimeout(client, 'SELECT 1 as test', [], 5000);
    console.log('✅ Database responsive');

    // Get all data in parallel with error handling for each query
    const [kpisResult, topPerformersResult, productCategoriesResult, industryComparisonResult, consumerCreditResult] = await Promise.allSettled([
      
      // 1. KPIs Query - Safe with COALESCE for NULL handling
      executeQueryWithTimeout(client, `
        SELECT 
          COUNT(DISTINCT firm_name)::text as total_firms,
          COUNT(*)::text as total_rows,
          COALESCE(ROUND(AVG(COALESCE(upheld_rate_pct, 0)::numeric), 2), 0)::text as avg_upheld_rate
        FROM complaint_metrics_staging
        WHERE reporting_period LIKE '2024%'
          AND firm_name IS NOT NULL
          AND firm_name != ''
      `, [], 10000),

      // 2. Top Performers Query - Best performers (lowest uphold rates)
      executeQueryWithTimeout(client, `
        SELECT 
          firm_name,
          COUNT(*)::text as complaint_count,
          COALESCE(ROUND(AVG(COALESCE(upheld_rate_pct, 0)::numeric), 1), 0)::text as avg_uphold_rate,
          COALESCE(ROUND(AVG(COALESCE(closed_within_3_days_pct, 0)::numeric), 1), 0)::text as avg_resolution_speed
        FROM complaint_metrics_staging
        WHERE reporting_period LIKE '2024%'
          AND firm_name IS NOT NULL
          AND firm_name != ''
          AND upheld_rate_pct IS NOT NULL
        GROUP BY firm_name
        HAVING COUNT(*) >= 1
        ORDER BY AVG(COALESCE(upheld_rate_pct, 100)::numeric) ASC
        LIMIT 10
      `, [], 10000),

      // 3. Product Categories Query
      executeQueryWithTimeout(client, `
        SELECT 
          product_category as category_name,
          COUNT(*)::text as complaint_count,
          COALESCE(ROUND(AVG(COALESCE(upheld_rate_pct, 0)::numeric), 1), 0)::text as avg_uphold_rate,
          COALESCE(ROUND(AVG(COALESCE(closed_within_3_days_pct, 0)::numeric), 1), 0)::text as avg_resolution_speed
        FROM complaint_metrics_staging
        WHERE reporting_period LIKE '2024%'
          AND product_category IS NOT NULL
          AND product_category != ''
        GROUP BY product_category
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `, [], 10000),

      // 4. Industry Comparison Query - All firms for scatter plot
      executeQueryWithTimeout(client, `
        SELECT 
          firm_name,
          COUNT(*)::text as complaint_count,
          COALESCE(ROUND(AVG(COALESCE(upheld_rate_pct, 0)::numeric), 1), 0)::text as avg_uphold_rate,
          COALESCE(ROUND(AVG(COALESCE(closed_within_3_days_pct, 0)::numeric), 1), 0)::text as avg_resolution_speed,
          COALESCE(ROUND(AVG(COALESCE(closed_after_3_days_within_8_weeks_pct, 0)::numeric), 1), 0)::text as avg_8week_resolution
        FROM complaint_metrics_staging
        WHERE reporting_period LIKE '2024%'
          AND firm_name IS NOT NULL
          AND firm_name != ''
        GROUP BY firm_name
        HAVING COUNT(*) >= 1
        ORDER BY AVG(COALESCE(upheld_rate_pct, 100)::numeric) ASC
        LIMIT 20
      `, [], 10000),

      // 5. Consumer Credit Query - Focus on banking/credit products
      executeQueryWithTimeout(client, `
        SELECT 
          firm_name,
          COUNT(*)::text as total_records,
          COALESCE(ROUND(AVG(COALESCE(upheld_rate_pct, 0)::numeric), 1), 0)::text as avg_upheld_pct,
          COALESCE(ROUND(AVG(COALESCE(closed_within_3_days_pct, 0)::numeric), 1), 0)::text as avg_resolution_speed
        FROM complaint_metrics_staging
        WHERE reporting_period LIKE '2024%'
          AND firm_name IS NOT NULL
          AND firm_name != ''
          AND (
            LOWER(product_category) LIKE '%banking%' 
            OR LOWER(product_category) LIKE '%credit%'
            OR LOWER(firm_name) LIKE '%financial%'
            OR LOWER(firm_name) LIKE '%credit%'
          )
        GROUP BY firm_name
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `, [], 10000)
    ]);

    console.log('✅ All queries completed');

    // Process results with error handling
    const kpis: KPIData = kpisResult.status === 'fulfilled' && kpisResult.value.rows.length > 0
      ? kpisResult.value.rows[0]
      : { total_firms: '0', total_rows: '0', avg_upheld_rate: '0' };

    const topPerformers: FirmData[] = topPerformersResult.status === 'fulfilled'
      ? topPerformersResult.value.rows
      : [];

    const productCategories: ProductData[] = productCategoriesResult.status === 'fulfilled'
      ? productCategoriesResult.value.rows
      : [];

    const industryComparison: FirmData[] = industryComparisonResult.status === 'fulfilled'
      ? industryComparisonResult.value.rows
      : [];

    const consumerCredit: ConsumerCreditData[] = consumerCreditResult.status === 'fulfilled'
      ? consumerCreditResult.value.rows
      : [];

    // Validate and format data
    const responseData = {
      success: true,
      data: {
        kpis: {
          total_complaints: validateNumber(kpis.total_rows),
          total_firms: validateNumber(kpis.total_firms),
          avg_upheld_rate: validatePercentage(kpis.avg_upheld_rate),
          total_rows: validateNumber(kpis.total_rows)
        },
        topPerformers: topPerformers.map((row: FirmData) => ({
          firm_name: validateString(row.firm_name, 150),
          complaint_count: validateNumber(row.complaint_count),
          avg_uphold_rate: validatePercentage(row.avg_uphold_rate).toFixed(1),
          avg_resolution_speed: row.avg_resolution_speed 
            ? validatePercentage(row.avg_resolution_speed).toFixed(1) 
            : undefined
        })),
        productCategories: productCategories.map((row: ProductData) => ({
          category_name: validateString(row.category_name, 100),
          complaint_count: validateNumber(row.complaint_count),
          avg_uphold_rate: validatePercentage(row.avg_uphold_rate).toFixed(1),
          avg_resolution_speed: row.avg_resolution_speed 
            ? validatePercentage(row.avg_resolution_speed).toFixed(1) 
            : undefined
        })),
        industryComparison: industryComparison.map((row: FirmData) => ({
          firm_name: validateString(row.firm_name, 150),
          complaint_count: validateNumber(row.complaint_count),
          avg_uphold_rate: validatePercentage(row.avg_uphold_rate).toFixed(1),
          avg_resolution_speed: row.avg_resolution_speed 
            ? validatePercentage(row.avg_resolution_speed).toFixed(1) 
            : undefined,
          avg_8week_resolution: (row as any).avg_8week_resolution 
            ? validatePercentage((row as any).avg_8week_resolution).toFixed(1) 
            : undefined
        })),
        consumerCredit: consumerCredit.map((row: ConsumerCreditData) => ({
          firm_name: validateString(row.firm_name, 150),
          total_received: validateNumber(row.total_records),
          avg_upheld_pct: validatePercentage(row.avg_upheld_pct).toFixed(1),
          avg_resolution_speed: row.avg_resolution_speed 
            ? validatePercentage(row.avg_resolution_speed).toFixed(1) 
            : undefined
        }))
      },
      debug: {
        timestamp: new Date().toISOString(),
        dataSource: 'real_database',
        executionTime: `${Date.now() - startTime}ms`,
        queryResults: {
          kpis: kpisResult.status === 'fulfilled' ? kpisResult.value.rowCount : 0,
          topPerformers: topPerformersResult.status === 'fulfilled' ? topPerformersResult.value.rowCount : 0,
          productCategories: productCategoriesResult.status === 'fulfilled' ? productCategoriesResult.value.rowCount : 0,
          industryComparison: industryComparisonResult.status === 'fulfilled' ? industryComparisonResult.value.rowCount : 0,
          consumerCredit: consumerCreditResult.status === 'fulfilled' ? consumerCreditResult.value.rowCount : 0
        },
        failedQueries: [
          kpisResult.status === 'rejected' ? 'kpis' : null,
          topPerformersResult.status === 'rejected' ? 'topPerformers' : null,
          productCategoriesResult.status === 'rejected' ? 'productCategories' : null,
          industryComparisonResult.status === 'rejected' ? 'industryComparison' : null,
          consumerCreditResult.status === 'rejected' ? 'consumerCredit' : null
        ].filter(Boolean),
        totalRecordsFound: validateNumber(kpis.total_rows)
      }
    };

    console.log('✅ Data processed successfully:', {
      executionTime: responseData.debug.executionTime,
      totalRecords: responseData.debug.totalRecordsFound,
      failedQueries: responseData.debug.failedQueries.length
    });

    return NextResponse.json(responseData);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    console.error('❌ Database error:', errorMessage);
    
    // Return fallback data with error info
    const fallbackResponse = getFallbackData(errorMessage);
    fallbackResponse.debug.executionTime = `${Date.now() - startTime}ms`;
    
    return NextResponse.json(fallbackResponse, { status: 200 }); // Still return 200 with fallback data
    
  } finally {
    // Always release the client
    if (client) {
      try {
        client.release();
        console.log('✅ Database client released');
      } catch (releaseError) {
        console.warn('⚠️ Error releasing client:', releaseError);
      }
    }
  }
}

// Health check endpoint
export async function HEAD(request: NextRequest) {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
