import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('API route called');
    
    // Simple test response first
    return NextResponse.json({
      success: true,
      connection: {
        database: 'neondb',
        user: 'neondb_owner',
        current_time: new Date().toISOString()
      },
      counts: {
        firms: 0,
        reportingPeriods: 5
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
