#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { connectWithRetry, createPoolConfig, loadLocalEnv } from './lib/db-runtime.mjs';

const { Pool } = pg;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSingleAttempt(attempt) {
  const pool = new Pool(
    createPoolConfig({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 5_000,
    })
  );

  let client = null;
  try {
    client = await connectWithRetry(pool, { label: `db:probe-connectivity attempt ${attempt}` });
    await client.query('SELECT 1 AS ok');
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    client?.release();
    await pool.end();
  }
}

async function main() {
  await loadLocalEnv(SCRIPT_DIR);
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const args = parseArgs(process.argv.slice(2));
  const attempts = Math.max(1, toInt(args.attempts, 8));
  const delayMs = Math.max(0, toInt(args['delay-ms'], 1_000));
  const allowFailures = Boolean(args['allow-failures']);

  let success = 0;
  let failure = 0;

  for (let i = 1; i <= attempts; i += 1) {
    const result = await runSingleAttempt(i);
    if (result.ok) {
      success += 1;
      console.log(`attempt ${i}/${attempts}: ok`);
    } else {
      failure += 1;
      console.log(`attempt ${i}/${attempts}: fail - ${result.error}`);
    }

    if (i < attempts && delayMs > 0) {
      await delay(delayMs);
    }
  }

  console.log(`summary: success=${success} failure=${failure}`);
  if (!allowFailures && failure > 0) {
    throw new Error(`connectivity probe failed (${failure}/${attempts} failed)`);
  }
}

main().catch((error) => {
  console.error('Connectivity probe failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
