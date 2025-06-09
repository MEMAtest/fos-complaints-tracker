import { NextResponse } from 'next/server';
import { testDatabaseConnection, DatabaseClient } from '@/lib/database';

export async function GET() {
  try {
    console.log('Testing real Neon database connection...');
    
    // Test the actual database connection
    const connectionTest = await testDatabaseConnection();
    
    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        error: connectionTest.error
      }, { status: 500 });
    }

    // Query real tables from your Neon database
    const firmCount = await DatabaseClient.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM firms'
    );

    const reportingPeriodCount = await DatabaseClient.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM reporting_periods'
    );

    const complaintMetricsCount = await DatabaseClient.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM complaint_metrics'
    );

    const consumerCreditCount = await DatabaseClient.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM consumer_credit_metrics'
    );

    return NextResponse.json({
      success: true,
      connection: connectionTest.info,
      counts: {
        firms: parseInt(firmCount?.count || '0'),
        reportingPeriods: parseInt(reportingPeriodCount?.count || '0'),
        complaintMetrics: parseInt(complaintMetricsCount?.count || '0'),
        consumerCreditMetrics: parseInt(consumerCreditCount?.count || '0')
      }
    });

  } catch (error) {
    console.error('Database connection failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Database connection failed'
    }, { status: 500 });
  }
}