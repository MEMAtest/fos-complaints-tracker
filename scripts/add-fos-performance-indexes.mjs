#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
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
    // Keep current process env when local env file is unavailable.
  }
}

async function main() {
  await loadLocalEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 2,
  });

  const client = await pool.connect();
  try {
    const statements = [
      'CREATE INDEX IF NOT EXISTS idx_fos_decisions_date_ref ON fos_decisions (decision_date DESC NULLS LAST, decision_reference ASC NULLS LAST)',
      'CREATE INDEX IF NOT EXISTS idx_fos_decisions_year_expr ON fos_decisions ((EXTRACT(YEAR FROM decision_date)::INT))',
      "CREATE INDEX IF NOT EXISTS idx_fos_decisions_product_norm ON fos_decisions ((COALESCE(NULLIF(BTRIM(product_sector), ''), 'Unspecified')))",
      "CREATE INDEX IF NOT EXISTS idx_fos_decisions_business_norm ON fos_decisions ((COALESCE(NULLIF(BTRIM(business_name), ''), 'Unknown firm')))",
    ];

    console.log('Creating FOS performance indexes...');
    for (const sql of statements) {
      const start = Date.now();
      await client.query(sql);
      console.log(`${sql.split(' ON ')[0]} (${Date.now() - start}ms)`);
    }
    console.log('Performance indexes ready.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Index creation failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
