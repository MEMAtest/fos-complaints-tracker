#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const LEGACY_TABLES = [
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

function timestampSlug() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

async function tableExists(client, tableName) {
  const rows = await client.query(
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
  return Boolean(rows.rows[0]?.exists);
}

async function tableCount(client, tableName) {
  const rows = await client.query(`SELECT COUNT(*)::INT AS count FROM public.${tableName}`);
  return Number(rows.rows[0]?.count || 0);
}

async function main() {
  await loadLocalEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const migrationPath = path.join(SCRIPT_DIR, '..', 'db', 'migrations', '20260219_fos_cutover.sql');
  const migrationSql = await fs.readFile(migrationPath, 'utf8');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();

  try {
    const backupSchema = `backup_fos_cutover_${timestampSlug()}`;
    const backupSummary = [];

    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${backupSchema}`);

    for (const tableName of LEGACY_TABLES) {
      const exists = await tableExists(client, tableName);
      if (!exists) continue;

      await client.query(`CREATE TABLE ${backupSchema}.${tableName} AS TABLE public.${tableName}`);
      const count = await tableCount(client, tableName);
      backupSummary.push({ tableName, count });
    }

    await client.query(migrationSql);

    for (const tableName of LEGACY_TABLES) {
      const exists = await tableExists(client, tableName);
      if (exists) {
        await client.query(`DROP TABLE public.${tableName}`);
      }
    }

    await client.query('COMMIT');

    console.log('Cutover completed.');
    console.log(`Backup schema: ${backupSchema}`);
    if (backupSummary.length === 0) {
      console.log('No legacy tables existed, nothing was backed up.');
    } else {
      console.log('Backup snapshot counts:');
      for (const item of backupSummary) {
        console.log(`- ${item.tableName}: ${item.count.toLocaleString()} rows`);
      }
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Cutover failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
