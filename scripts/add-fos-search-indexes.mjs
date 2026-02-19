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
    // No local env file; keep process env as-is.
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

