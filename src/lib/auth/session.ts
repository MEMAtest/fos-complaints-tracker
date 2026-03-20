import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { DatabaseClient } from '@/lib/database';
import { SESSION_COOKIE_NAME } from './constants';
import { ensureAuthSchema } from './schema';
import type { AppUserRole, AuthSession, AuthenticatedAppUser, BootstrapAuthUser } from './types';
import { APP_USER_ROLES } from './types';

const SESSION_TTL_DAYS = parseIntEnv(process.env.AUTH_SESSION_TTL_DAYS, 7, 1, 30);
const BOOTSTRAP_USERS_ENV = process.env.APP_BOOTSTRAP_USERS_JSON;

let bootstrapPromise: Promise<void> | null = null;
let bootstrapReady = false;

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export async function ensureAuthReady(): Promise<void> {
  await ensureAuthSchema();
  await bootstrapAuthUsers();
}

export async function loginWithPassword(request: NextRequest, email: string, password: string): Promise<{ sessionToken: string; session: AuthSession }> {
  await ensureAuthReady();
  const userRow = await DatabaseClient.queryOne<Record<string, unknown>>(
    `
      SELECT id, email, full_name, role, password_hash, is_active
      FROM app_users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email.trim()]
  );

  if (!userRow || !toBoolean(userRow.is_active, true)) {
    throw new AuthError('Invalid email or password.', 401);
  }

  if (!verifyPassword(password, String(userRow.password_hash || ''))) {
    throw new AuthError('Invalid email or password.', 401);
  }

  const sessionToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const ipAddress = clientIpFromRequest(request);
  const userAgent = sanitizeNullable(request.headers.get('user-agent'));

  const sessionRow = await DatabaseClient.queryOne<Record<string, unknown>>(
    `
      INSERT INTO app_sessions (user_id, session_token_hash, expires_at, last_seen_at, ip_address, user_agent)
      VALUES ($1, $2, $3, NOW(), $4, $5)
      RETURNING id, expires_at, last_seen_at
    `,
    [userRow.id, tokenHash, expiresAt.toISOString(), ipAddress, userAgent]
  );

  await DatabaseClient.query(
    `UPDATE app_users SET last_login_at = NOW() WHERE id = $1`,
    [userRow.id]
  );

  return {
    sessionToken,
    session: {
      id: String(sessionRow?.id || ''),
      expiresAt: toIsoDateTime(sessionRow?.expires_at),
      lastSeenAt: toIsoDateTime(sessionRow?.last_seen_at),
      user: mapUser(userRow),
    },
  };
}

export async function getAuthSessionFromRequest(request: Pick<NextRequest, 'cookies' | 'headers'>): Promise<AuthSession | null> {
  await ensureAuthReady();
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return null;
  return getAuthSessionByToken(sessionToken, request.headers.get('user-agent'));
}

export async function requireAuthenticatedUser(request: Pick<NextRequest, 'cookies' | 'headers'>, minimumRole: AppUserRole = 'viewer'): Promise<AuthenticatedAppUser> {
  const session = await getAuthSessionFromRequest(request);
  if (!session) {
    throw new AuthError('Authentication required.', 401);
  }
  if (!canAccessRole(session.user.role, minimumRole)) {
    throw new AuthError(`A ${minimumRole} role is required for this action.`, 403);
  }
  return session.user;
}

export async function logoutFromRequest(request: Pick<NextRequest, 'cookies' | 'headers'>): Promise<void> {
  await ensureAuthReady();
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return;
  await invalidateSessionToken(sessionToken);
}

export async function invalidateSessionToken(sessionToken: string): Promise<void> {
  await ensureAuthReady();
  await DatabaseClient.query(
    `DELETE FROM app_sessions WHERE session_token_hash = $1`,
    [hashToken(sessionToken)]
  );
}

export function buildSessionCookieHeader(sessionToken: string, expiresAt: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}

export function clearSessionCookieHeader(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
}

export function normalizeAppUserRole(rawRole: string | null | undefined): AppUserRole {
  const value = String(rawRole || '').trim().toLowerCase();
  return APP_USER_ROLES.includes(value as AppUserRole) ? (value as AppUserRole) : 'viewer';
}

export function roleRank(role: AppUserRole): number {
  switch (role) {
    case 'admin':
      return 5;
    case 'manager':
      return 4;
    case 'reviewer':
      return 3;
    case 'operator':
      return 2;
    case 'viewer':
    default:
      return 1;
  }
}

export function canAccessRole(role: AppUserRole, minimumRole: AppUserRole): boolean {
  return roleRank(role) >= roleRank(minimumRole);
}

async function getAuthSessionByToken(sessionToken: string, userAgent: string | null): Promise<AuthSession | null> {
  const tokenHash = hashToken(sessionToken);
  const row = await DatabaseClient.queryOne<Record<string, unknown>>(
    `
      SELECT
        s.id,
        s.expires_at,
        s.last_seen_at,
        u.id AS user_id,
        u.email,
        u.full_name,
        u.role,
        u.is_active
      FROM app_sessions s
      INNER JOIN app_users u ON u.id = s.user_id
      WHERE s.session_token_hash = $1
        AND s.expires_at > NOW()
      LIMIT 1
    `,
    [tokenHash]
  );

  if (!row || !toBoolean(row.is_active, true)) {
    return null;
  }

  await DatabaseClient.query(
    `
      UPDATE app_sessions
      SET last_seen_at = NOW(),
          user_agent = COALESCE($2, user_agent)
      WHERE id = $1
    `,
    [row.id, sanitizeNullable(userAgent)]
  ).catch(() => undefined);

  return {
    id: String(row.id || ''),
    expiresAt: toIsoDateTime(row.expires_at),
    lastSeenAt: toIsoDateTime(row.last_seen_at),
    user: mapUser({
      id: row.user_id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
    }),
  };
}

async function bootstrapAuthUsers(): Promise<void> {
  if (bootstrapReady) return;
  if (!bootstrapPromise) {
    bootstrapPromise = doBootstrapAuthUsers().finally(() => {
      bootstrapPromise = null;
    });
  }
  await bootstrapPromise;
  bootstrapReady = true;
}

async function doBootstrapAuthUsers(): Promise<void> {
  const specs = getBootstrapUsers();
  if (specs.length === 0) return;

  for (const spec of specs) {
    const passwordHash = spec.passwordHash || hashPassword(spec.password || '');
    await DatabaseClient.query(
      `
        INSERT INTO app_users (email, full_name, role, password_hash, is_active)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (email)
        DO UPDATE SET
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          password_hash = EXCLUDED.password_hash,
          is_active = TRUE
      `,
      [spec.email.trim().toLowerCase(), spec.fullName.trim(), spec.role, passwordHash]
    );
  }
}

function getBootstrapUsers(): BootstrapAuthUser[] {
  if (BOOTSTRAP_USERS_ENV && BOOTSTRAP_USERS_ENV.trim()) {
    try {
      const parsed = JSON.parse(BOOTSTRAP_USERS_ENV);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry) => normalizeBootstrapUser(entry))
        .filter((entry): entry is BootstrapAuthUser => Boolean(entry));
    } catch (error) {
      console.error('[auth] failed to parse APP_BOOTSTRAP_USERS_JSON:', error);
      return [];
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  return [
    { email: 'viewer@local.test', fullName: 'Workspace Viewer', role: 'viewer', password: 'ViewerPass123!' },
    { email: 'operator@local.test', fullName: 'Workspace Operator', role: 'operator', password: 'OperatorPass123!' },
    { email: 'reviewer@local.test', fullName: 'Workspace Reviewer', role: 'reviewer', password: 'ReviewerPass123!' },
    { email: 'manager@local.test', fullName: 'Workspace Manager', role: 'manager', password: 'ManagerPass123!' },
    { email: 'admin@local.test', fullName: 'Workspace Admin', role: 'admin', password: 'AdminPass123!' },
  ];
}

function normalizeBootstrapUser(input: unknown): BootstrapAuthUser | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const email = String(record.email || '').trim().toLowerCase();
  const fullName = String(record.fullName || record.name || '').trim();
  const role = normalizeAppUserRole(typeof record.role === 'string' ? record.role : 'viewer');
  const password = typeof record.password === 'string' ? record.password : undefined;
  const passwordHash = typeof record.passwordHash === 'string' ? record.passwordHash : undefined;
  if (!email || !fullName || (!password && !passwordHash)) return null;
  return { email, fullName, role, password, passwordHash };
}

function mapUser(row: Record<string, unknown>): AuthenticatedAppUser {
  return {
    id: String(row.id || row.user_id || ''),
    email: String(row.email || '').trim().toLowerCase(),
    fullName: String(row.full_name || row.fullName || '').trim() || 'Workspace user',
    role: normalizeAppUserRole(typeof row.role === 'string' ? row.role : 'viewer'),
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashPassword(password: string, salt?: string): string {
  const safePassword = String(password || '');
  const resolvedSalt = salt || randomBytes(16).toString('hex');
  const derivedKey = scryptSync(safePassword, resolvedSalt, 64).toString('hex');
  return `scrypt$${resolvedSalt}$${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expected] = parts;
  const derived = scryptSync(String(password || ''), salt, 64).toString('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const derivedBuffer = Buffer.from(derived, 'hex');
  if (expectedBuffer.length !== derivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, derivedBuffer);
}

function clientIpFromRequest(request: Pick<NextRequest, 'headers'>): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return sanitizeNullable(forwardedFor.split(',')[0]);
  }
  return sanitizeNullable(request.headers.get('x-real-ip'));
}

function sanitizeNullable(value: string | null | undefined): string | null {
  const text = String(value || '').trim();
  return text ? text : null;
}

function toIsoDateTime(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return new Date(0).toISOString();
  return date.toISOString();
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', 'f', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function parseIntEnv(rawValue: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(rawValue || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
