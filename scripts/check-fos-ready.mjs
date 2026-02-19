#!/usr/bin/env node

import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const TABLES = [
  'fos_decisions',
  'fos_ingestion_runs',
  'complaint_metrics_staging',
  'consumer_credit_metrics',
  'dashboard_kpis',
  'product_categories',
  'reporting_periods',
  'firms',
];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

async function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(SCRIPT_DIR, '..', '.env.local');
  try {
    const raw = await fs.readFile(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // No local env file; keep process env as-is.
  }
}

async function main() {
  await loadLocalEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();

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
      if (!item.exists) {
        console.log(`- ${item.tableName}: missing`);
      } else {
        console.log(`- ${item.tableName}: ${item.count.toLocaleString()} rows`);
      }
    });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Check failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
