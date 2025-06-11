import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    console.log('🔍 Debugging actual database content...');
    
    const debug: any = {};
    const tableNames = ['firms', 'consumer_credit_metrics', 'product_categories', 'dashboard_kpis', 'complaint_metrics_staging'];
    
    for (const tableName of tableNames) {
      try {
        // Get table structure
        const columns = await sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = ${tableName}
          ORDER BY ordinal_position
        `;
        
        // Get row count
        const countResult = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`;
        const rowCount = Number(countResult[0]?.count || 0);
        
        // Get actual sample data
        const sampleData = await sql`SELECT * FROM ${sql(tableName)} LIMIT 5`;
        
        debug[tableName] = {
          columns: columns.map(c => ({ name: c.column_name, type: c.data_type })),
          rowCount: rowCount,
          sampleData: sampleData,
          hasData: rowCount > 0
        };
        
        console.log(`📊 ${tableName}: ${columns.length} columns, ${rowCount} rows`);
        
      } catch (tableError) {
        console.log(`⚠️ Could not access ${tableName}:`, tableError);
        debug[tableName] = { 
          error: tableError instanceof Error ? tableError.message : String(tableError),
          accessible: false
        };
      }
    }
    
    // Try some specific queries to see what data we can actually get
    const testQueries: any = {};
    
    // Test firms table
    try {
      if (debug.firms && !debug.firms.error && debug.firms.rowCount > 0) {
        const firmsTest = await sql`SELECT * FROM firms LIMIT 3`;
        testQueries.firms = {
          query: 'SELECT * FROM firms LIMIT 3',
          result: firmsTest,
          columnNames: Object.keys(firmsTest[0] || {})
        };
      }
    } catch (e) {
      testQueries.firms = { error: e instanceof Error ? e.message : String(e) };
    }
    
    // Test consumer_credit_metrics
    try {
      if (debug.consumer_credit_metrics && !debug.consumer_credit_metrics.error && debug.consumer_credit_metrics.rowCount > 0) {
        const ccmTest = await sql`SELECT * FROM consumer_credit_metrics LIMIT 3`;
        testQueries.consumer_credit_metrics = {
          query: 'SELECT * FROM consumer_credit_metrics LIMIT 3',
          result: ccmTest,
          columnNames: Object.keys(ccmTest[0] || {})
        };
      }
    } catch (e) {
      testQueries.consumer_credit_metrics = { error: e instanceof Error ? e.message : String(e) };
    }
    
    // Test dashboard_kpis
    try {
      if (debug.dashboard_kpis && !debug.dashboard_kpis.error && debug.dashboard_kpis.rowCount > 0) {
        const kpisTest = await sql`SELECT * FROM dashboard_kpis LIMIT 3`;
        testQueries.dashboard_kpis = {
          query: 'SELECT * FROM dashboard_kpis LIMIT 3',
          result: kpisTest,
          columnNames: Object.keys(kpisTest[0] || {})
        };
      }
    } catch (e) {
      testQueries.dashboard_kpis = { error: e instanceof Error ? e.message : String(e) };
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tableAnalysis: debug,
      testQueries: testQueries,
      summary: {
        totalTables: Object.keys(debug).length,
        tablesWithData: Object.values(debug).filter((t: any) => t.hasData).length,
        tablesWithErrors: Object.values(debug).filter((t: any) => t.error).length
      }
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
