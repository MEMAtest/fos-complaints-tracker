import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🚀 DIAGNOSTIC: API route called at:', new Date().toISOString());
    
    // ✅ STEP 1: Test basic API response
    console.log('✅ STEP 1: Basic API response test - SUCCESS');
    
    // ✅ STEP 2: Test environment variables
    console.log('🔍 STEP 2: Checking environment variables...');
    const hasDbUrl = !!process.env.DATABASE_URL;
    console.log('DATABASE_URL exists:', hasDbUrl);
    
    if (!hasDbUrl) {
      return NextResponse.json({
        error: 'DATABASE_URL missing',
        step: 'environment_check',
        debug: { hasDbUrl: false }
      }, { status: 500 });
    }
    
    // ✅ STEP 3: Test Neon import
    console.log('🔍 STEP 3: Testing Neon import...');
    let neonModule: any;
    try {
      neonModule = await import('@neondatabase/serverless');
      console.log('✅ Neon module imported successfully');
    } catch (importError: any) {
      console.error('❌ Failed to import Neon module:', importError);
      return NextResponse.json({
        error: 'Failed to import Neon module',
        step: 'neon_import',
        details: importError.message
      }, { status: 500 });
    }
    
    // ✅ STEP 4: Test database connection
    console.log('🔍 STEP 4: Testing database connection...');
    let sql: any;
    try {
      const { neon } = neonModule;
      sql = neon(process.env.DATABASE_URL!);
      console.log('✅ SQL client created successfully');
    } catch (connectionError: any) {
      console.error('❌ Failed to create SQL client:', connectionError);
      return NextResponse.json({
        error: 'Failed to create database client',
        step: 'database_client',
        details: connectionError.message
      }, { status: 500 });
    }
    
    // ✅ STEP 5: Test simple query
    console.log('🔍 STEP 5: Testing simple database query...');
    let testResult: any;
    try {
      testResult = await sql`SELECT 1 as test_value, NOW() as current_time`;
      console.log('✅ Simple query successful:', testResult);
    } catch (queryError: any) {
      console.error('❌ Simple query failed:', queryError);
      return NextResponse.json({
        error: 'Database query failed',
        step: 'simple_query',
        details: queryError.message
      }, { status: 500 });
    }
    
    // ✅ STEP 6: Test table existence
    console.log('🔍 STEP 6: Testing table existence...');
    let tableCheck: any;
    try {
      tableCheck = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('complaint_metrics_staging', 'consumer_credit_metrics', 'firms', 'reporting_periods')
        ORDER BY table_name
      `;
      console.log('✅ Table check successful:', tableCheck);
    } catch (tableError: any) {
      console.error('❌ Table check failed:', tableError);
      return NextResponse.json({
        error: 'Failed to check tables',
        step: 'table_check',
        details: tableError.message
      }, { status: 500 });
    }
    
    // ✅ STEP 7: Test data query
    console.log('🔍 STEP 7: Testing basic data query...');
    let dataTest: any;
    try {
      dataTest = await sql`
        SELECT COUNT(*) as record_count
        FROM complaint_metrics_staging 
        LIMIT 1
      `;
      console.log('✅ Data query successful:', dataTest);
    } catch (dataError: any) {
      console.error('❌ Data query failed:', dataError);
      return NextResponse.json({
        error: 'Failed to query data',
        step: 'data_query',
        details: dataError.message
      }, { status: 500 });
    }
    
    // ✅ SUCCESS: Return diagnostic results
    const executionTime = Date.now() - startTime;
    
    const response = {
      success: true,
      message: 'All diagnostic steps passed!',
      steps: {
        step1_api_response: '✅ SUCCESS',
        step2_environment: '✅ SUCCESS',
        step3_neon_import: '✅ SUCCESS', 
        step4_database_client: '✅ SUCCESS',
        step5_simple_query: '✅ SUCCESS',
        step6_table_check: '✅ SUCCESS',
        step7_data_query: '✅ SUCCESS'
      },
      data: {
        // Return minimal working data structure
        kpis: {
          total_complaints: parseInt(dataTest?.[0]?.record_count) || 0,
          total_closed: 0,
          total_firms: 0,
          avg_upheld_rate: 0,
          avg_percentage_upheld: 0,
          avg_closed_within_8_weeks: 0,
          sector_uphold_averages: {},
          sector_closure_averages: {},
          all_sector_averages: {}
        },
        topPerformers: [],
        consumerCredit: [],
        productCategories: [],
        industryComparison: [],
        allFirms: [],
        historicalTrends: [],
        industryTrends: []
      },
      debug: {
        executionTime: `${executionTime}ms`,
        dataSource: 'Diagnostic Mode',
        databaseUrl: process.env.DATABASE_URL ? 'Present' : 'Missing',
        tableCount: tableCheck?.length || 0,
        recordCount: parseInt(dataTest?.[0]?.record_count) || 0,
        testQuery: testResult?.[0] || null,
        availableTables: tableCheck?.map((t: any) => t.table_name) || []
      }
    };
    
    console.log('🎉 DIAGNOSTIC COMPLETE - All steps successful!');
    return NextResponse.json(response);
    
  } catch (criticalError: any) {
    console.error('💥 CRITICAL ERROR in diagnostic:', criticalError);
    
    return NextResponse.json({
      error: 'Critical diagnostic failure',
      step: 'critical_error',
      message: criticalError instanceof Error ? criticalError.message : 'Unknown critical error',
      details: {
        name: criticalError.name,
        message: criticalError.message,
        stack: criticalError.stack?.split('\n').slice(0, 5)
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
