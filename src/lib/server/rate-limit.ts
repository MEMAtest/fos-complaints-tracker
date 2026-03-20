type RateLimitWindow = {
  resetAt: number;
  count: number;
};

type GlobalWithRateLimit = typeof globalThis & {
  __fciRateLimitWindows?: Map<string, RateLimitWindow>;
};

const globalForRateLimit = globalThis as GlobalWithRateLimit;
const windows = globalForRateLimit.__fciRateLimitWindows ?? new Map<string, RateLimitWindow>();

if (!globalForRateLimit.__fciRateLimitWindows) {
  globalForRateLimit.__fciRateLimitWindows = windows;
}

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

export function rateLimitOrThrow(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    pruneExpired(now);
    return;
  }

  if (current.count >= limit) {
    throw new RateLimitError('Rate limit exceeded.', Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
  }

  current.count += 1;
  windows.set(key, current);
}

export function clientKeyFromRequest(request: Request, actorKey: string) {
  const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  return `${actorKey}:${forwardedFor.split(',')[0].trim() || 'unknown'}`;
}

function pruneExpired(now: number) {
  if (windows.size < 500) return;
  for (const [key, value] of windows.entries()) {
    if (value.resetAt <= now) {
      windows.delete(key);
    }
  }
}
