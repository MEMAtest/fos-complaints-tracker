#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

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

async function readEnvFileMap(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const vars = new Map();
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      vars.set(key, value);
    }
    return vars;
  } catch {
    return null;
  }
}

function dbTargetFromUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.replace(/^\//, '') || null,
      sslmode: url.searchParams.get('sslmode') || null,
    };
  } catch {
    return null;
  }
}

function describeTarget(name, target) {
  if (!target) return `${name}: missing or invalid`;
  return `${name}: host=${target.host} port=${target.port} database=${target.database || 'n/a'} sslmode=${target.sslmode || 'n/a'}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const strict = !args['allow-mismatch'];

  const localEnvPath = path.join(SCRIPT_DIR, '..', '.env.local');
  const vercelEnvPath = path.join(SCRIPT_DIR, '..', '.env.vercel');

  const [localVars, vercelVars] = await Promise.all([readEnvFileMap(localEnvPath), readEnvFileMap(vercelEnvPath)]);
  const localTarget = dbTargetFromUrl(localVars?.get('DATABASE_URL'));
  const vercelTarget = dbTargetFromUrl(vercelVars?.get('DATABASE_URL'));

  console.log(describeTarget('.env.local', localTarget));
  console.log(describeTarget('.env.vercel', vercelTarget));

  const localHost = localTarget?.host || null;
  const vercelHost = vercelTarget?.host || null;

  if (!localHost || !vercelHost) {
    if (strict) {
      throw new Error('DATABASE_URL missing or invalid in one or both env files.');
    }
    console.log('Target verification skipped strict mismatch checks due missing values.');
    return;
  }

  if (localHost !== vercelHost) {
    const message = `Host mismatch: .env.local=${localHost} vs .env.vercel=${vercelHost}`;
    if (strict) throw new Error(message);
    console.warn(message);
  } else {
    console.log('Host alignment OK: .env.local and .env.vercel point to the same DB host.');
  }
}

main().catch((error) => {
  console.error('DB target verification failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
