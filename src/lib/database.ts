// src/lib/database.ts
import { Pool } from 'pg';
import type { PoolClient } from 'pg';

type SslMode = 'disable' | 'require' | 'verify-ca' | 'verify-full';

function parseIntEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeSslMode(rawMode: string | null | undefined): SslMode | null {
  if (!rawMode) return null;
  const mode = rawMode.trim().toLowerCase();
  if (['disable', 'disabled', 'false', 'no', 'off'].includes(mode)) return 'disable';
  if (['allow', 'prefer', 'require', 'true', 'on'].includes(mode)) return 'require';
  if (['verify-ca', 'verifyca'].includes(mode)) return 'verify-ca';
  if (['verify-full', 'verifyfull'].includes(mode)) return 'verify-full';
  return null;
}

function sslModeFromDatabaseUrl(connectionString: string | undefined): SslMode | null {
  if (!connectionString) return null;
  try {
    const url = new URL(connectionString);
    return normalizeSslMode(url.searchParams.get('sslmode'));
  } catch {
    return null;
  }
}

function isLocalDatabaseUrl(connectionString: string | undefined): boolean {
  if (!connectionString) return false;
  try {
    const url = new URL(connectionString);
    const hostname = (url.hostname || '').trim().toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function resolveSslOptions(connectionString: string | undefined) {
  const explicitMode = normalizeSslMode(process.env.DB_SSL_MODE);
  const detectedMode = explicitMode || sslModeFromDatabaseUrl(connectionString);
  const mode = detectedMode || (isLocalDatabaseUrl(connectionString) ? 'disable' : 'require');

  if (mode === 'disable') return false;
  if (mode === 'verify-ca' || mode === 'verify-full') {
    return { rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

function isTransientDbError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const code = String(err?.code || '').toUpperCase();
  if (['EAI_AGAIN', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'EPIPE', 'EPERM'].includes(code)) {
    return true;
  }

  const message = String(err?.message || '').toLowerCase();
  return (
    message.includes('connection terminated unexpectedly') ||
    message.includes('connection timeout') ||
    message.includes('server closed the connection') ||
    message.includes('could not connect')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DATABASE_URL = process.env.DATABASE_URL;
const DB_POOL_MAX = parseIntEnv(process.env.DB_POOL_MAX, 8, 1, 200);
const DB_IDLE_TIMEOUT_MS = parseIntEnv(process.env.DB_IDLE_TIMEOUT_MS, 30_000, 1_000, 300_000);
const DB_CONNECT_TIMEOUT_MS = parseIntEnv(process.env.DB_CONNECT_TIMEOUT_MS, 5_000, 500, 120_000);
const DB_QUERY_TIMEOUT_MS = parseIntEnv(process.env.DB_QUERY_TIMEOUT_MS, 15_000, 1_000, 300_000);
const DB_IDLE_IN_TX_TIMEOUT_MS = parseIntEnv(process.env.DB_IDLE_IN_TX_TIMEOUT_MS, 10_000, 1_000, 300_000);
const DB_MAX_USES = parseIntEnv(process.env.DB_MAX_USES, 7_500, 0, 1_000_000);
const DB_CONNECT_RETRIES = parseIntEnv(process.env.DB_CONNECT_RETRIES, 2, 0, 10);
const DB_RETRY_BASE_MS = parseIntEnv(process.env.DB_RETRY_BASE_MS, 200, 50, 10_000);
const DB_RETRY_MAX_MS = parseIntEnv(process.env.DB_RETRY_MAX_MS, 2_000, 100, 120_000);

type GlobalWithDbPool = typeof globalThis & {
  __fciDbPool?: Pool;
};

function createPool() {
  return new Pool({
    connectionString: DATABASE_URL,
    ssl: resolveSslOptions(DATABASE_URL),
    max: DB_POOL_MAX,
    maxUses: DB_MAX_USES > 0 ? DB_MAX_USES : undefined,
    idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
    query_timeout: DB_QUERY_TIMEOUT_MS,
    statement_timeout: DB_QUERY_TIMEOUT_MS,
    idle_in_transaction_session_timeout: DB_IDLE_IN_TX_TIMEOUT_MS,
    application_name: process.env.DB_APPLICATION_NAME || 'fos-complaints-tracker',
    allowExitOnIdle: process.env.NODE_ENV !== 'production',
  });
}

const globalForDbPool = globalThis as GlobalWithDbPool;
const pool = globalForDbPool.__fciDbPool ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  globalForDbPool.__fciDbPool = pool;
}

export { pool };

export class DatabaseClient {
  static async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= DB_CONNECT_RETRIES + 1; attempt += 1) {
      let client: PoolClient | null = null;
      try {
        client = await pool.connect();
        const result = await client.query(text, params);
        return result.rows;
      } catch (error) {
        lastError = error;
        if (attempt > DB_CONNECT_RETRIES || !isTransientDbError(error)) {
          throw error;
        }
        const delayMs = Math.min(DB_RETRY_MAX_MS, Math.round(DB_RETRY_BASE_MS * 2 ** (attempt - 1)));
        if (process.env.NODE_ENV !== 'test') {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[db-retry] query attempt ${attempt}/${DB_CONNECT_RETRIES + 1} failed: ${message}. Retrying in ${delayMs}ms.`);
        }
        await delay(delayMs);
      } finally {
        client?.release();
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Database query failed.');
  }

  static async queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] || null;
  }

  static async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  static async getConnectionInfo(): Promise<Record<string, unknown>> {
    return await this.queryOne(`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        now() as current_time
    `) || {};
  }
}

export async function testDatabaseConnection(): Promise<{
  success: boolean;
  info?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const isHealthy = await DatabaseClient.healthCheck();
    if (!isHealthy) {
      return { success: false, error: 'Health check failed' };
    }

    const info = await DatabaseClient.getConnectionInfo();
    return { success: true, info };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
