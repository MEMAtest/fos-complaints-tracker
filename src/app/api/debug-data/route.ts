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
        console.log(`🔍 Checking table: ${tableName}`);
        
        // Get table structure - fix the syntax
        const columns = await sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = ${tableName}
          ORDER BY ordinal_position
        `;
        
        // Get row count using string interpolation instead of sql template
        const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
        const countResult = await sql([countQuery] as any);
        const rowCount = Number(countResult[0]?.count || 0);
        
        // Get sample data using string interpolation
        const sampleQuery = `SELECT * FROM ${tableName} LIMIT 3`;
        const sampleData = await sql([sampleQuery] as any);
        
        debug[tableName] = {
          columns: columns.map(c => ({ name: c.column_name, type: c.data_type })),
          rowCount: rowCount,
          sampleData: sampleData,
          hasData: rowCount > 0,
          status: 'success'
        };
        
        console.log(`✅ ${tableName}: ${columns.length} columns, ${rowCount} rows`);
        
      } catch (tableError) {
        console.log(`⚠️ Could not access ${tableName}:`, tableError);
        debug[tableName] = { 
          error: tableError instanceof Error ? tableError.message : String(tableError),
          accessible: false,
          status: 'error'
        };
      }
    }
    
    // Simple test queries for working tables
    const workingTables = Object.keys(debug).filter(t => debug[t].status === 'success' && debug[t].hasData);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tableAnalysis: debug,
      summary: {
        totalTables: Object.keys(debug).length,
        tablesWithData: workingTables.length,
        tablesWithErrors: Object.values(debug).filter((t: any) => t.status === 'error').length,
        workingTables: workingTables
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
