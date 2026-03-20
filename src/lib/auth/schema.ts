import { DatabaseClient } from '@/lib/database';

const AUTH_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_users_role_check CHECK (role IN ('viewer', 'operator', 'reviewer', 'manager', 'admin'))
);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users (role);
CREATE INDEX IF NOT EXISTS idx_app_users_active ON app_users (is_active);

CREATE TABLE IF NOT EXISTS app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions (expires_at DESC);

DO $$
BEGIN
  CREATE OR REPLACE FUNCTION set_app_auth_updated_at()
  RETURNS TRIGGER AS $fn$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_app_users_updated_at ON app_users;
  CREATE TRIGGER trg_app_users_updated_at BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION set_app_auth_updated_at();
END $$;
`;

let schemaPromise: Promise<void> | null = null;
let schemaReady = false;

const AUTH_TABLES = ['app_users', 'app_sessions'];

export async function ensureAuthSchema(): Promise<void> {
  if (schemaReady) return;
  if (!(await hasAuthTables())) {
    if (!schemaPromise) {
      schemaPromise = DatabaseClient.query(AUTH_SCHEMA_SQL).then(() => undefined).finally(() => {
        schemaPromise = null;
      });
    }
    await schemaPromise;
  }

  if (await hasAuthTables()) {
    schemaReady = true;
    return;
  }

  throw new Error('Authentication schema is not ready.');
}

async function hasAuthTables(): Promise<boolean> {
  const row = await DatabaseClient.queryOne<{ existing_count: number }>(
    `
      SELECT COUNT(*)::INT AS existing_count
      FROM UNNEST($1::text[]) AS table_name
      WHERE to_regclass('public.' || table_name) IS NOT NULL
    `,
    [AUTH_TABLES]
  );
  return Number(row?.existing_count || 0) === AUTH_TABLES.length;
}
