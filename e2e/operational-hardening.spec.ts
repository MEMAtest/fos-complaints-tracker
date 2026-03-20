import { test, expect, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('complaints export enforces fixed-window rate limiting for authenticated users', async ({ page }) => {
  test.setTimeout(120_000);

  await signIn(page, 'manager@local.test', 'ManagerPass123!');
  await page.goto('/complaints');
  await expect(page.getByRole('heading', { name: 'Complaints Workspace' })).toBeVisible();

  const statuses = await page.evaluate(async () => {
    const results: Array<{ status: number; retryAfter: string | null }> = [];
    for (let index = 0; index < 21; index += 1) {
      const response = await fetch('/api/complaints/export', { cache: 'no-store' });
      results.push({
        status: response.status,
        retryAfter: response.headers.get('Retry-After'),
      });
    }
    return results;
  });

  expect(statuses.slice(0, 20).every((item) => item.status === 200)).toBe(true);
  expect(statuses[20]?.status).toBe(429);
  expect(Number(statuses[20]?.retryAfter || '0')).toBeGreaterThan(0);
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.evaluate(async ({ email, password }) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'same-origin',
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Login failed.');
    }
  }, { email, password });
  await expect.poll(async () => {
    return page.evaluate(async () => {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      return response.status;
    });
  }).toBe(200);
}
