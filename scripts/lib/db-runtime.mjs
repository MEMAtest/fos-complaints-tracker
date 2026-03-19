import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const TRANSIENT_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'EPIPE',
  'EPERM',
]);

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSslMode(rawMode) {
  if (!rawMode) return null;
  const mode = String(rawMode).trim().toLowerCase();

  if (['disable', 'disabled', 'false', 'no', 'off'].includes(mode)) return 'disable';
  if (['allow', 'prefer', 'require', 'true', 'on'].includes(mode)) return 'require';
  if (['verify-ca', 'verifyca'].includes(mode)) return 'verify-ca';
  if (['verify-full', 'verifyfull'].includes(mode)) return 'verify-full';

  return null;
}

function sslModeFromConnectionString(connectionString) {
  if (!connectionString) return null;
  try {
    const url = new URL(connectionString);
    return normalizeSslMode(url.searchParams.get('sslmode'));
  } catch {
    return null;
  }
}

function isLocalDatabaseUrl(connectionString) {
  if (!connectionString) return false;
  try {
    const url = new URL(connectionString);
    const hostname = String(url.hostname || '').trim().toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

export function resolveSslMode(connectionString = process.env.DATABASE_URL) {
  const explicitEnvMode = normalizeSslMode(process.env.DB_SSL_MODE);
  if (explicitEnvMode) return explicitEnvMode;

  const connectionMode = sslModeFromConnectionString(connectionString);
  if (connectionMode) return connectionMode;

  return isLocalDatabaseUrl(connectionString) ? 'disable' : 'require';
}

export function resolveSslConfig(connectionString = process.env.DATABASE_URL) {
  const mode = resolveSslMode(connectionString);
  if (mode === 'disable') return false;
  if (mode === 'verify-ca' || mode === 'verify-full') {
    return { rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

export function createPoolConfig({
  connectionString = process.env.DATABASE_URL,
  max = 10,
  idleTimeoutMillis = 30_000,
  connectionTimeoutMillis = 5_000,
} = {}) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required.');
  }

  return {
    connectionString,
    ssl: resolveSslConfig(connectionString),
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
  };
}

export function isTransientDbError(error) {
  const code = String(error?.code || '').toUpperCase();
  if (TRANSIENT_ERROR_CODES.has(code)) return true;

  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('connection terminated unexpectedly') ||
    message.includes('connection timeout') ||
    message.includes('too many clients already') ||
    message.includes('could not connect') ||
    message.includes('server closed the connection')
  );
}

export function resolveRetryConfig() {
  return {
    retries: clamp(toInt(process.env.DB_CONNECT_RETRIES ?? 3, 3), 0, 12),
    baseDelayMs: clamp(toInt(process.env.DB_RETRY_BASE_MS ?? 350, 350), 50, 30_000),
    maxDelayMs: clamp(toInt(process.env.DB_RETRY_MAX_MS ?? 4_000, 4_000), 100, 120_000),
  };
}

export async function withRetry(operation, options = {}) {
  const defaults = resolveRetryConfig();
  const retries = options.retries ?? defaults.retries;
  const baseDelayMs = options.baseDelayMs ?? defaults.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? defaults.maxDelayMs;
  const label = options.label || 'database operation';
  const shouldRetry = options.shouldRetry || isTransientDbError;

  let lastError = null;
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const retryable = shouldRetry(error);
      if (!retryable || attempt > retries) {
        throw error;
      }

      const delayMs = Math.min(maxDelayMs, Math.round(baseDelayMs * 2 ** (attempt - 1)));
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[db-retry] ${label} failed (attempt ${attempt}/${retries + 1}): ${message}. Retrying in ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }

  throw lastError || new Error(`${label} failed`);
}

export async function connectWithRetry(pool, options = {}) {
  return withRetry(() => pool.connect(), {
    label: options.label || 'database connection',
    retries: options.retries,
    baseDelayMs: options.baseDelayMs,
    maxDelayMs: options.maxDelayMs,
    shouldRetry: options.shouldRetry,
  });
}

export async function loadLocalEnv(scriptDir) {
  if (process.env.DATABASE_URL) return;

  const envPath = path.join(scriptDir, '..', '.env.local');
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
    // Keep process env when .env.local is unavailable.
  }
}

export function getDatabaseTarget(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) return null;
  try {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.replace(/^\//, '') || null,
      sslMode: resolveSslMode(connectionString),
    };
  } catch {
    return null;
  }
}
