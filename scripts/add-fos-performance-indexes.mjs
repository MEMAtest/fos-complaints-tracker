#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { connectWithRetry, createPoolConfig, loadLocalEnv } from './lib/db-runtime.mjs';

const { Pool } = pg;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await loadLocalEnv(SCRIPT_DIR);
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const pool = new Pool(
    createPoolConfig({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 8_000,
    })
  );

  const client = await connectWithRetry(pool, { label: 'db:add-fos-performance-indexes connect' });
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
