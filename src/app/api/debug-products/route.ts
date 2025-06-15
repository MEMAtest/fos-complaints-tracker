// src/app/api/debug-products/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    console.log('🔍 Debugging product categories...');
    
    // Check complaint_metrics_staging table for product categories
    const stagingQuery = `
      SELECT 
        product_category,
        COUNT(*) as complaint_count,
        COUNT(DISTINCT firm_name) as firm_count,
        ROUND(AVG(upheld_rate_pct), 2) as avg_uphold_rate
      FROM complaint_metrics_staging 
      WHERE product_category IS NOT NULL 
        AND product_category != ''
      GROUP BY product_category
      ORDER BY complaint_count DESC
    `;
    
    const stagingResults = await sql(stagingQuery);
    
    // ✅ FIXED: Explicit type annotation
    let separateTableResults: any[] = [];
    try {
      const separateQuery = `
        SELECT * FROM product_categories 
        LIMIT 10
      `;
      separateTableResults = await sql(separateQuery);
    } catch (error) {
      console.log('No separate product_categories table found');
    }
    
    // Check for any similar column names
    const columnQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'complaint_metrics_staging'
        AND (column_name LIKE '%product%' OR column_name LIKE '%category%')
      ORDER BY column_name
    `;
    
    const columnResults = await sql(columnQuery);
    
    // Sample data to see actual values
    const sampleQuery = `
      SELECT DISTINCT product_category
      FROM complaint_metrics_staging 
      WHERE product_category IS NOT NULL 
        AND product_category != ''
      ORDER BY product_category
      LIMIT 20
    `;
    
    const sampleResults = await sql(sampleQuery);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        stagingTableData: stagingResults,
        separateTableData: separateTableResults,
        productRelatedColumns: columnResults,
        allUniqueCategories: sampleResults,
        summary: {
          totalUniqueCategories: stagingResults.length,
          hasSeparateTable: separateTableResults.length > 0,
          productColumns: columnResults.length
        }
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