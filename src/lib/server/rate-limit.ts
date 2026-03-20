import { DatabaseClient } from '@/lib/database';

const RATE_LIMIT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_rate_limit_windows (
  scope_key TEXT NOT NULL,
  bucket_start_ms BIGINT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope_key, bucket_start_ms)
);

CREATE INDEX IF NOT EXISTS idx_app_rate_limit_windows_reset_at
  ON app_rate_limit_windows (reset_at);
`;

type RateLimitRow = {
  count: number | string | null;
};

let schemaPromise: Promise<void> | null = null;

export class RateLimitError extends Error {
  status: number;
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = 'RateLimitError';
    this.status = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function rateLimitOrThrow(key: string, limit: number, windowMs: number): Promise<void> {
  await ensureRateLimitSchema();

  const now = Date.now();
  const bucketStartMs = Math.floor(now / windowMs) * windowMs;
  const resetAtMs = bucketStartMs + windowMs;
  const row = await DatabaseClient.queryOne<RateLimitRow>(
    `
      INSERT INTO app_rate_limit_windows (scope_key, bucket_start_ms, count, reset_at)
      VALUES ($1, $2, 1, to_timestamp($3 / 1000.0))
      ON CONFLICT (scope_key, bucket_start_ms)
      DO UPDATE SET
        count = app_rate_limit_windows.count + 1,
        updated_at = NOW()
      RETURNING count
    `,
    [key, bucketStartMs, resetAtMs]
  );

  const count = Number(row?.count || 0);
  if (count > limit) {
    throw new RateLimitError('Rate limit exceeded.', Math.max(1, Math.ceil((resetAtMs - now) / 1000)));
  }

  if (count === 1 || count % 25 === 0) {
    void pruneExpiredWindows(now).catch(() => undefined);
  }
}

export function clientKeyFromRequest(request: Request, actorKey: string) {
  const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  return `${actorKey}:${forwardedFor.split(',')[0].trim() || 'unknown'}`;
}

async function ensureRateLimitSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = DatabaseClient.query(RATE_LIMIT_SCHEMA_SQL)
      .then(() => undefined)
      .finally(() => {
        schemaPromise = null;
      });
  }
  await schemaPromise;
}

async function pruneExpiredWindows(now: number): Promise<void> {
  await DatabaseClient.query(
    `DELETE FROM app_rate_limit_windows WHERE reset_at < to_timestamp($1 / 1000.0) - INTERVAL '1 hour'`,
    [now]
  );
}
