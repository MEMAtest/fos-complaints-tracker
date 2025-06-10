// src/app/api/upload-csv/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@neondatabase/serverless';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const dataType = formData.get('dataType') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Read CSV content
    const csvText = await file.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    console.log(`Processing ${dataType} with ${lines.length - 1} data rows`);
    console.log('Headers:', headers);

    let processedCount = 0;
    const errors: string[] = [];

    // Process each data row (skip header)
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        
        if (values.length < 3) continue; // Skip incomplete rows

        // Extract firm name and period from CSV
        const firmName = values[0]?.trim();
        const periodStr = values[1]?.trim();
        
        if (!firmName || !periodStr) continue;

        // Parse reporting period (e.g., "H1 2023" or "H2 2023")
        const periodMatch = periodStr.match(/(H[12])\s+(\d{4})/);
        if (!periodMatch) {
          errors.push(`Invalid period format: ${periodStr}`);
          continue;
        }

        const [, period, year] = periodMatch;

        // Get or create firm
        let firmResult = await sql`
          SELECT id FROM firms WHERE name = ${firmName}
        `;
        
        let firmId;
        if (firmResult.rows.length === 0) {
          const insertFirm = await sql`
            INSERT INTO firms (name, created_at, updated_at) 
            VALUES (${firmName}, NOW(), NOW()) 
            RETURNING id
          `;
          firmId = insertFirm.rows[0].id;
        } else {
          firmId = firmResult.rows[0].id;
        }

        // Get or create reporting period
        let periodResult = await sql`
          SELECT id FROM reporting_periods WHERE period = ${period} AND year = ${parseInt(year)}
        `;
        
        let periodId;
        if (periodResult.rows.length === 0) {
          const insertPeriod = await sql`
            INSERT INTO reporting_periods (period, year, created_at, updated_at) 
            VALUES (${period}, ${parseInt(year)}, NOW(), NOW()) 
            RETURNING id
          `;
          periodId = insertPeriod.rows[0].id;
        } else {
          periodId = periodResult.rows[0].id;
        }

        // Process based on data type
        if (dataType === 'consumer_credit') {
          // Consumer credit has different structure
          const complaintsReceived = parseFloat(values[2]) || 0;
          const complaintsClosed = parseFloat(values[3]) || 0;
          const complaintsUpheldPct = parseFloat(values[4]) || 0;

          await sql`
            INSERT INTO consumer_credit_metrics 
            (firm_id, reporting_period_id, complaints_received, complaints_closed, complaints_upheld_pct, created_at, updated_at)
            VALUES (${firmId}, ${periodId}, ${complaintsReceived}, ${complaintsClosed}, ${complaintsUpheldPct}, NOW(), NOW())
            ON CONFLICT (firm_id, reporting_period_id) 
            DO UPDATE SET 
              complaints_received = EXCLUDED.complaints_received,
              complaints_closed = EXCLUDED.complaints_closed,
              complaints_upheld_pct = EXCLUDED.complaints_upheld_pct,
              updated_at = NOW()
          `;
        } else {
          // Regular complaint metrics
          // Assume product categories are in remaining columns
          for (let j = 2; j < values.length && j < 7; j++) { // Max 5 product categories
            const value = parseFloat(values[j]);
            if (isNaN(value)) continue;

            const productCategoryId = j - 1; // Categories 1-5

            let metricColumn;
            switch (dataType) {
              case 'closed_3_days':
                metricColumn = 'closed_within_3_days_pct';
                break;
              case 'after_3_days':
                metricColumn = 'closed_after_3_days_within_8_weeks_pct';
                break;
              case 'upheld':
                metricColumn = 'upheld_rate_pct';
                break;
              default:
                continue;
            }

            await sql`
              INSERT INTO complaint_metrics 
              (firm_id, reporting_period_id, product_category_id, ${sql(metricColumn)}, created_at, updated_at)
              VALUES (${firmId}, ${periodId}, ${productCategoryId}, ${value}, NOW(), NOW())
              ON CONFLICT (firm_id, reporting_period_id, product_category_id) 
              DO UPDATE SET 
                ${sql(metricColumn)} = EXCLUDED.${sql(metricColumn)},
                updated_at = NOW()
            `;
          }
        }

        processedCount++;
      } catch (rowError) {
        errors.push(`Row ${i}: ${rowError}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedCount} records`,
      dataType,
      processedCount,
      errors: errors.slice(0, 10) // Show first 10 errors only
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process CSV file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}