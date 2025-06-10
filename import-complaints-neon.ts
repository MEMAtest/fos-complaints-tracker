// scripts/data-import/import-complaints-neon.ts
// Optimized CSV import script for FOS Complaints Tracker

import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

interface ImportProgress {
  processed: number;
  total: number;
  errors: string[];
  currentFile: string;
  startTime: Date;
  filesProcessed: number;
  totalFiles: number;
}

class OptimizedComplaintsImporter {
  private pool: Pool;
  private progress: ImportProgress = {
    processed: 0,
    total: 0,
    errors: [],
    currentFile: '',
    startTime: new Date(),
    filesProcessed: 0,
    totalFiles: 0
  };

  // Cache for database IDs to avoid repeated lookups
  private firmCache = new Map<string, string>();
  private periodCache = new Map<string, string>();
  private productCategoryCache = new Map<string, string>();

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.initializeProductCategoryCache();
  }

  private async initializeProductCategoryCache(): Promise<void> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT id, code FROM product_categories');
      client.release();
      
      result.rows.forEach(cat => {
        this.productCategoryCache.set(cat.code, cat.id);
      });
      console.log(`✅ Cached ${result.rows.length} product categories`);
    } catch (error: unknown) {
      console.error('❌ Failed to cache product categories:', error);
    }
  }

  private parseDateRange(dateRange: string): { 
    start: string; 
    end: string; 
    semester: 'H1' | 'H2'; 
    year: number 
  } {
    const [startStr, endStr] = dateRange.split(' to ');
    const start = new Date(startStr);
    const end = new Date(endStr);
    const year = start.getFullYear();
    
    const startMonth = start.getMonth() + 1;
    const semester: 'H1' | 'H2' = startMonth <= 6 ? 'H1' : 'H2';
    
    return { 
      start: start.toISOString().split('T')[0], 
      end: end.toISOString().split('T')[0], 
      semester, 
      year 
    };
  }

  private parsePercentage(value: string | undefined): number | null {
    if (!value || value.trim() === '') return null;
    const cleaned = value.replace('%', '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  private parseBoolean(value: string): boolean {
    return value.toLowerCase() === 'yes';
  }

  private async ensureFirm(name: string, groupName: string, jointReporting: boolean): Promise<string> {
    const cacheKey = `${name}|${groupName}|${jointReporting}`;
    
    if (this.firmCache.has(cacheKey)) {
      return this.firmCache.get(cacheKey)!;
    }

    const client = await this.pool.connect();
    try {
      // Check if firm exists
      let result = await client.query('SELECT id FROM firms WHERE name = $1', [name]);
      
      if (result.rows.length > 0) {
        const firmId = result.rows[0].id;
        this.firmCache.set(cacheKey, firmId);
        return firmId;
      }

      // Create new firm
      result = await client.query(
        'INSERT INTO firms (name, group_name, joint_reporting) VALUES ($1, $2, $3) RETURNING id',
        [name, groupName === 'NO GROUP' ? null : groupName, jointReporting]
      );

      const firmId = result.rows[0].id;
      this.firmCache.set(cacheKey, firmId);
      return firmId;
    } finally {
      client.release();
    }
  }

  private async ensureReportingPeriod(start: string, end: string, semester: 'H1' | 'H2', year: number): Promise<string> {
    const cacheKey = `${start}|${end}`;
    
    if (this.periodCache.has(cacheKey)) {
      return this.periodCache.get(cacheKey)!;
    }

    const client = await this.pool.connect();
    try {
      // Check if period exists
      let result = await client.query(
        'SELECT id FROM reporting_periods WHERE period_start = $1 AND period_end = $2',
        [start, end]
      );

      if (result.rows.length > 0) {
        const periodId = result.rows[0].id;
        this.periodCache.set(cacheKey, periodId);
        return periodId;
      }

      // Create new period
      result = await client.query(
        'INSERT INTO reporting_periods (period_start, period_end, semester, year) VALUES ($1, $2, $3, $4) RETURNING id',
        [start, end, semester, year]
      );

      const periodId = result.rows[0].id;
      this.periodCache.set(cacheKey, periodId);
      return periodId;
    } finally {
      client.release();
    }
  }

  private getProductCategoryId(code: string): string {
    const id = this.productCategoryCache.get(code);
    if (!id) {
      throw new Error(`Product category not found: ${code}`);
    }
    return id;
  }

  async importComplaintMetrics(
    csvPath: string,
    metricType: 'closed_within_3_days' | 'closed_after_3_days' | 'upheld',
    onProgress?: (progress: ImportProgress) => void
  ): Promise<void> {
    console.log(`\n🚀 Importing ${metricType} from ${path.basename(csvPath)}`);
    
    this.progress.currentFile = path.basename(csvPath);
    this.progress.processed = 0;
    this.progress.startTime = new Date();

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          this.progress.total = results.data.length;
          console.log(`📊 Processing ${results.data.length} rows...`);
          
          try {
            // Process in optimized batches
            const batchSize = 200; // Larger batches for better performance
            const allMetrics: any[] = [];

            for (let i = 0; i < results.data.length; i += batchSize) {
              const batch = results.data.slice(i, i + batchSize);
              
              for (const row of batch) {
                try {
                  const firmName = (row as any)['Firm Name']?.trim();
                  const groupName = (row as any)['Group']?.trim();
                  const jointReporting = this.parseBoolean((row as any)['Joint Reporting'] || 'no');
                  const dateRange = (row as any)['Reporting period'];

                  if (!firmName || !dateRange) {
                    this.progress.errors.push(`Missing data in row: ${JSON.stringify(row)}`);
                    continue;
                  }

                  const { start, end, semester, year } = this.parseDateRange(dateRange);
                  
                  const firmId = await this.ensureFirm(firmName, groupName, jointReporting);
                  const reportingPeriodId = await this.ensureReportingPeriod(start, end, semester, year);

                  // Process each product category
                  const productCategories = [
                    { code: 'banking', column: 'Banking and credit cards' },
                    { code: 'pensions', column: 'Decumulation & pensions' },
                    { code: 'home', column: 'Home finance' },
                    { code: 'insurance', column: 'Insurance & pure protection' },
                    { code: 'investments', column: 'Investments' }
                  ];

                  for (const { code, column } of productCategories) {
                    const value = this.parsePercentage((row as any)[column]);
                    
                    if (value !== null) {
                      const productCategoryId = this.getProductCategoryId(code);
                      
                      allMetrics.push({
                        firm_id: firmId,
                        reporting_period_id: reportingPeriodId,
                        product_category_id: productCategoryId,
                        metric_type: metricType,
                        value: value
                      });
                    }
                  }

                  this.progress.processed++;
                  if (onProgress && this.progress.processed % 100 === 0) {
                    onProgress(this.progress);
                  }

                } catch (error: unknown) {
                  this.progress.errors.push(`Row error: ${error instanceof Error ? error.message : String(error)}`);
                }
              }

              // Progress update
              const percent = Math.round((i + batchSize) / results.data.length * 100);
              console.log(`⚡ Processed ${Math.min(i + batchSize, results.data.length)}/${results.data.length} rows (${percent}%)`);
            }

            // Bulk upsert all metrics at once
            if (allMetrics.length > 0) {
              await this.bulkUpsertMetrics(allMetrics, metricType);
            }

            const duration = Date.now() - this.progress.startTime.getTime();
            console.log(`✨ Completed in ${Math.round(duration / 1000)}s - ${this.progress.processed} records, ${this.progress.errors.length} errors`);
            
            resolve();

          } catch (error: unknown) {
            reject(error);
          }
        },
        error: (error: unknown) => {
          reject(new Error(`CSV parsing error: ${error instanceof Error ? error.message : String(error)}`));
        }
      });
    });
  }

  private async bulkUpsertMetrics(metrics: any[], metricType: string): Promise<void> {
    if (metrics.length === 0) return;

    console.log(`💾 Bulk upserting ${metrics.length} metrics...`);

    // Group by unique constraint
    const grouped = new Map<string, any>();
    
    metrics.forEach(metric => {
      const key = `${metric.firm_id}|${metric.reporting_period_id}|${metric.product_category_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          firm_id: metric.firm_id,
          reporting_period_id: metric.reporting_period_id,
          product_category_id: metric.product_category_id,
          closed_within_3_days_pct: null,
          closed_after_3_days_within_8_weeks_pct: null,
          upheld_rate_pct: null
        });
      }
      
      const existing = grouped.get(key)!;
      if (metricType === 'closed_within_3_days') {
        existing.closed_within_3_days_pct = metric.value;
      } else if (metricType === 'closed_after_3_days') {
        existing.closed_after_3_days_within_8_weeks_pct = metric.value;
      } else if (metricType === 'upheld') {
        existing.upheld_rate_pct = metric.value;
      }
    });

    // Bulk insert with single query
    const values = Array.from(grouped.values());
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const value of values) {
        await client.query(`
          INSERT INTO complaint_metrics 
            (firm_id, reporting_period_id, product_category_id, 
             closed_within_3_days_pct, closed_after_3_days_within_8_weeks_pct, upheld_rate_pct)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (firm_id, reporting_period_id, product_category_id)
          DO UPDATE SET
            closed_within_3_days_pct = COALESCE(EXCLUDED.closed_within_3_days_pct, complaint_metrics.closed_within_3_days_pct),
            closed_after_3_days_within_8_weeks_pct = COALESCE(EXCLUDED.closed_after_3_days_within_8_weeks_pct, complaint_metrics.closed_after_3_days_within_8_weeks_pct),
            upheld_rate_pct = COALESCE(EXCLUDED.upheld_rate_pct, complaint_metrics.upheld_rate_pct),
            updated_at = NOW()
        `, [value.firm_id, value.reporting_period_id, value.product_category_id, 
            value.closed_within_3_days_pct, value.closed_after_3_days_within_8_weeks_pct, value.upheld_rate_pct]);
      }
      
      await client.query('COMMIT');
      console.log(`✅ Successfully upserted ${values.length} complaint metrics`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async importConsumerCreditMetrics(csvPath: string, onProgress?: (progress: ImportProgress) => void): Promise<void> {
    console.log(`\n💳 Importing consumer credit from ${path.basename(csvPath)}`);
    
    this.progress.currentFile = path.basename(csvPath);
    this.progress.processed = 0;
    this.progress.startTime = new Date();

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          this.progress.total = results.data.length;
          
          try {
            const batchSize = 200;
            const allMetrics: any[] = [];

            for (let i = 0; i < results.data.length; i += batchSize) {
              const batch = results.data.slice(i, i + batchSize);

              for (const row of batch) {
                try {
                  const firmName = (row as any)['Firm Name']?.trim();
                  const groupName = (row as any)['Group']?.trim();
                  const jointReporting = this.parseBoolean((row as any)['Joint Reporting'] || 'no');
                  const dateRange = (row as any)['Reporting period'];
                  const received = parseInt((row as any)['Complaints Received']?.replace(/,/g, '') || '0') || 0;
                  const closed = parseInt((row as any)['Complaints Closed']?.replace(/,/g, '') || '0') || 0;
                  const upheldPct = this.parsePercentage((row as any)['Complaints Upheld (%)']);
                  const frequency = (row as any)['Reporting frequency'] || 'Half Yearly';

                  if (!firmName || !dateRange) {
                    this.progress.errors.push(`Missing data: ${JSON.stringify(row)}`);
                    continue;
                  }

                  const { start, end, semester, year } = this.parseDateRange(dateRange);
                  
                  const firmId = await this.ensureFirm(firmName, groupName, jointReporting);
                  const reportingPeriodId = await this.ensureReportingPeriod(start, end, semester, year);

                  allMetrics.push({
                    firm_id: firmId,
                    reporting_period_id: reportingPeriodId,
                    complaints_received: received,
                    complaints_closed: closed,
                    complaints_upheld_pct: upheldPct,
                    reporting_frequency: frequency
                  });

                  this.progress.processed++;
                  if (onProgress && this.progress.processed % 100 === 0) {
                    onProgress(this.progress);
                  }

                } catch (error: unknown) {
                  this.progress.errors.push(`Consumer credit row error: ${error instanceof Error ? error.message : String(error)}`);
                }
              }
            }

            // Bulk insert consumer credit
            if (allMetrics.length > 0) {
              await this.bulkInsertConsumerCredit(allMetrics);
            }

            const duration = Date.now() - this.progress.startTime.getTime();
            console.log(`✨ Consumer Credit completed in ${Math.round(duration / 1000)}s`);
            
            resolve();

          } catch (error) {
            reject(error);
          }
        },
        error: (error: unknown) => {
          reject(new Error(`CSV parsing error: ${error instanceof Error ? error.message : String(error)}`));
        }
      });
    });
  }

  private async bulkInsertConsumerCredit(metrics: any[]): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const metric of metrics) {
        await client.query(`
          INSERT INTO consumer_credit_metrics 
            (firm_id, reporting_period_id, complaints_received, complaints_closed, complaints_upheld_pct, reporting_frequency)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (firm_id, reporting_period_id)
          DO UPDATE SET
            complaints_received = EXCLUDED.complaints_received,
            complaints_closed = EXCLUDED.complaints_closed,
            complaints_upheld_pct = EXCLUDED.complaints_upheld_pct,
            reporting_frequency = EXCLUDED.reporting_frequency,
            updated_at = NOW()
        `, [metric.firm_id, metric.reporting_period_id, metric.complaints_received, 
            metric.complaints_closed, metric.complaints_upheld_pct, metric.reporting_frequency]);
      }
      
      await client.query('COMMIT');
      console.log(`✅ Successfully inserted ${metrics.length} consumer credit records`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async processDirectory(
    directoryPath: string,
    metricType: 'closed_within_3_days' | 'closed_after_3_days' | 'upheld' | 'consumer_credit'
  ): Promise<void> {
    console.log(`\n🗂️  Processing directory: ${directoryPath}`);
    
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`Directory does not exist: ${directoryPath}`);
    }

    const files = fs.readdirSync(directoryPath)
      .filter(file => file.endsWith('.csv'))
      .map(file => path.join(directoryPath, file));

    console.log(`📁 Found ${files.length} CSV files`);
    this.progress.totalFiles = files.length;

    for (const filePath of files) {
      try {
        this.progress.filesProcessed++;
        console.log(`\n📄 Processing file ${this.progress.filesProcessed}/${this.progress.totalFiles}: ${path.basename(filePath)}`);
        
        if (metricType === 'consumer_credit') {
          await this.importConsumerCreditMetrics(filePath);
        } else {
          await this.importComplaintMetrics(filePath, metricType);
        }

        console.log(`✅ Completed ${path.basename(filePath)}`);

      } catch (error) {
        console.error(`❌ Failed to process ${filePath}:`, error);
        this.progress.errors.push(`File ${filePath}: ${error}`);
      }
    }

    // Refresh materialized views
    console.log('\n🔄 Refreshing materialized views...');
    const client = await this.pool.connect();
    try {
      await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY firm_performance_summary');
      await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY consumer_credit_summary');
      console.log('✅ Views refreshed');
    } catch (error) {
      console.log('⚠️ View refresh failed (may not exist yet)');
    } finally {
      client.release();
    }

    console.log(`\n🎉 Processing complete!`);
    console.log(`📊 Files: ${this.progress.filesProcessed}/${this.progress.totalFiles}`);
    console.log(`❌ Errors: ${this.progress.errors.length}`);
    
    if (this.progress.errors.length > 0) {
      console.log('\n⚠️ First 5 errors:');
      this.progress.errors.slice(0, 5).forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// CLI interface
async function main() {
  // Load environment variables
  require('dotenv').config({ path: '../../.env.local' });

  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: npm run import <directory> <type>');
    console.log('Types: closed_3_days, after_3_days, upheld, consumer_credit');
    console.log('Example: npm run import ../../data/closed-within-3-days closed_3_days');
    process.exit(1);
  }

  const directory = args[0];
  const type = args[1] as 'closed_3_days' | 'after_3_days' | 'upheld' | 'consumer_credit';

  const typeMapping: Record<string, any> = {
    'closed_3_days': 'closed_within_3_days',
    'after_3_days': 'closed_after_3_days',
    'upheld': 'upheld',
    'consumer_credit': 'consumer_credit'
  };

  const metricType = typeMapping[type];
  if (!metricType) {
    console.error(`❌ Invalid type: ${type}`);
    process.exit(1);
  }

  console.log(`🚀 Starting import: ${type} from ${directory}`);
  console.log(`🔌 Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Not found'}`);

  const importer = new OptimizedComplaintsImporter();
  
  try {
    await importer.processDirectory(directory, metricType);
    console.log(`\n🎉 Import completed successfully!`);
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  } finally {
    await importer.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { OptimizedComplaintsImporter };
