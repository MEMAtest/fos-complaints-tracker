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
  const client = await connectWithRetry(pool, { label: 'db:add-fos-search-indexes connect' });

  try {
    console.log('Creating FOS search indexes...');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    const statements = [
      'CREATE INDEX IF NOT EXISTS idx_fos_decisions_reference_trgm ON fos_decisions USING gin (decision_reference gin_trgm_ops)',
      'CREATE INDEX IF NOT EXISTS idx_fos_decisions_business_trgm ON fos_decisions USING gin (business_name gin_trgm_ops)',
      'CREATE INDEX IF NOT EXISTS idx_fos_decisions_product_trgm ON fos_decisions USING gin (product_sector gin_trgm_ops)',
      'CREATE INDEX IF NOT EXISTS idx_fos_decisions_summary_trgm ON fos_decisions USING gin (decision_summary gin_trgm_ops)',
      'CREATE INDEX IF NOT EXISTS idx_fos_decisions_logic_trgm ON fos_decisions USING gin (decision_logic gin_trgm_ops)',
    ];

    for (const sql of statements) {
      const start = Date.now();
      await client.query(sql);
      console.log(`${sql.split(' ON ')[0]} (${Date.now() - start}ms)`);
    }

    console.log('Search indexes ready.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Index creation failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
