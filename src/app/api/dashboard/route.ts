import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'initial_load';

    console.log(`📊 API Request - Type: ${type}`);

    if (type === 'initial_load') {
      // Get basic KPIs first with error handling
      try {
        const kpis = await sql`
          SELECT 
            COUNT(*) as total_rows,
            SUM(CASE WHEN total_complaints IS NOT NULL THEN total_complaints ELSE 0 END) as total_complaints,
            AVG(CASE WHEN upheld_rate_pct IS NOT NULL THEN upheld_rate_pct ELSE 0 END) as avg_uphold_rate
          FROM complaint_metrics
        `;
        
        console.log('✅ KPIs query successful:', kpis[0]);
        
        // Get firms with real names
        const firms = await sql`
          SELECT 
            f.firm_name,
            COUNT(cm.firm_id) as complaint_count,
            AVG(cm.upheld_rate_pct) as avg_uphold_rate
          FROM firms f
          LEFT JOIN complaint_metrics cm ON f.firm_id = cm.firm_id
          GROUP BY f.firm_id, f.firm_name
          HAVING COUNT(cm.firm_id) > 0
          ORDER BY avg_uphold_rate ASC
          LIMIT 20
        `;
        
        console.log(`✅ Found ${firms.length} firms with data`);
        
        // Get product categories
        const categories = await sql`
          SELECT 
            pc.category_name,
            COUNT(cm.product_category_id) as complaint_count
          FROM product_categories pc
          LEFT JOIN complaint_metrics cm ON pc.product_category_id = cm.product_category_id
          GROUP BY pc.product_category_id, pc.category_name
          HAVING COUNT(cm.product_category_id) > 0
          ORDER BY complaint_count DESC
        `;
        
        console.log(`✅ Found ${categories.length} product categories`);
        
        // Get consumer credit data
        const consumerCredit = await sql`
          SELECT 
            f.firm_name,
            SUM(ccm.complaints_received) as total_received,
            AVG(ccm.complaints_upheld_pct) as avg_upheld_pct
          FROM consumer_credit_metrics ccm
          JOIN firms f ON ccm.firm_id = f.firm_id
          GROUP BY f.firm_id, f.firm_name
          ORDER BY total_received DESC
          LIMIT 10
        `;
        
        console.log(`✅ Found ${consumerCredit.length} consumer credit entries`);

        return NextResponse.json({
          success: true,
          data: {
            kpis: kpis[0] || { total_complaints: 0, avg_uphold_rate: 0, total_rows: 0 },
            topPerformers: firms || [],
            productCategories: categories || [],
            industryComparison: firms || [],
            consumerCredit: consumerCredit || []
          },
          debug: {
            timestamp: new Date().toISOString(),
            dataFound: {
              kpis: !!kpis[0],
              firms: firms.length,
              categories: categories.length,
              consumerCredit: consumerCredit.length
            }
          }
        });
        
      } catch (queryError) {
        console.error('❌ Query error:', queryError);
        
        // Properly handle the error type
        const errorMessage = queryError instanceof Error ? queryError.message : String(queryError);
        const errorStack = queryError instanceof Error ? queryError.stack : undefined;
        
        return NextResponse.json({
          success: false,
          error: 'Database query failed',
          details: errorMessage,
          stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
          query_attempted: 'initial_load'
        }, { status: 500 });
      }
    }

    // Handle other request types
    return NextResponse.json({ 
      success: true, 
      message: `${type} endpoint ready`,
      data: {
        kpis: { total_complaints: 0, avg_uphold_rate: 0 },
        topPerformers: [],
        productCategories: [],
        industryComparison: [],
        consumerCredit: []
      }
    });

  } catch (error) {
    console.error('❌ API error:', error);
    
    // Properly handle the error type
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json({
      success: false,
      error: 'API request failed',
      details: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}
