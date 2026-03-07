#!/usr/bin/env node

import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { connectWithRetry, createPoolConfig, loadLocalEnv } from './lib/db-runtime.mjs';

const { Pool } = pg;

const REQUIRED_TABLES = ['fos_decisions', 'fos_ingestion_runs'];
const LEGACY_OPTIONAL_TABLES = [
  'complaint_metrics_staging',
  'consumer_credit_metrics',
  'dashboard_kpis',
  'product_categories',
  'reporting_periods',
  'firms',
];
const TABLES = [...REQUIRED_TABLES, ...LEGACY_OPTIONAL_TABLES];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await loadLocalEnv(SCRIPT_DIR);
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const pool = new Pool(
    createPoolConfig({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 8_000,
    })
  );
  const client = await connectWithRetry(pool, { label: 'db:check connect' });

  try {
    const report = [];
    for (const tableName of TABLES) {
      const existsRows = await client.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = $1
          ) AS exists
        `,
        [tableName]
      );

      const exists = Boolean(existsRows.rows[0]?.exists);
      if (!exists) {
        report.push({ tableName, exists, count: 0 });
        continue;
      }

      const countRows = await client.query(`SELECT COUNT(*)::INT AS count FROM public.${tableName}`);
      report.push({ tableName, exists, count: Number(countRows.rows[0]?.count || 0) });
    }

    console.log('Database table status:');
    report.forEach((item) => {
      const required = REQUIRED_TABLES.includes(item.tableName);
      if (!item.exists) {
        const label = required ? 'missing (required)' : 'missing (legacy optional)';
        console.log(`- ${item.tableName}: ${label}`);
      } else {
        const suffix = required ? ' (required)' : ' (legacy optional)';
        console.log(`- ${item.tableName}: ${item.count.toLocaleString()} rows${suffix}`);
      }
    });

    const missingRequired = report
      .filter((item) => REQUIRED_TABLES.includes(item.tableName) && !item.exists)
      .map((item) => item.tableName);

    if (missingRequired.length > 0) {
      throw new Error(`Missing required tables: ${missingRequired.join(', ')}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Check failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
