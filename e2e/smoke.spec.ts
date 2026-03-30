import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Smoke tests - pages load', () => {
  test('Homepage loads with marketing hero', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('See live complaint intelligence clearly');
    await expect(page.getByRole('main').getByRole('link', { name: /explore live data/i }).first()).toBeVisible();
  });

  test('Workspace dashboard loads with KPI cards', async ({ page }) => {
    await page.goto('/workspace');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('FOS Complaints Intelligence');
    await expect(page.locator('section').first()).toBeVisible();
  });

  test('Analysis page loads', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('Deep Analysis Workspace');
  });

  test('Root Causes page loads', async ({ page }) => {
    await page.goto('/root-causes');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('Root Cause Analysis');
  });

  test('Comparison page loads with firm selectors', async ({ page }) => {
    await page.goto('/comparison');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('Firm Comparison');
    await expect(page.getByRole('button', { name: /add firm/i })).toBeVisible();
  });
});

test.describe('Smoke tests - sidebar navigation', () => {
  test('Navigate between all pages via sidebar', async ({ page }) => {
    await page.goto('/workspace');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('FOS Complaints Intelligence');
    const nav = page.locator('aside').getByRole('navigation');

    // Navigate to Analysis
    await nav.getByRole('link', { name: /^Analysis$/i }).click();
    await expect(page).toHaveURL(/\/analysis(\?.*)?$/);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('Deep Analysis Workspace');

    // Navigate to Root Causes
    await nav.getByRole('link', { name: /root causes/i }).click();
    await expect(page).toHaveURL(/\/root-causes(\?.*)?$/);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('Root Cause Analysis');

    // Navigate to Comparison
    await nav.getByRole('link', { name: /^Firm Comparison$/i }).click();
    await expect(page).toHaveURL(/\/comparison(\?.*)?$/);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('Firm Comparison');

    // Navigate back to Dashboard
    await nav.getByRole('link', { name: /^Dashboard$/i }).click();
    await expect(page).toHaveURL(/\/workspace(\?.*)?$/);
  });
});

test.describe('Smoke tests - API routes', () => {
  test('GET /api/fos/dashboard returns 200 with success', async ({ request }) => {
    const res = await request.get('/api/fos/dashboard');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  test('GET /api/fos/analysis returns 200 with success', async ({ request }) => {
    const res = await request.get('/api/fos/analysis');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  test('GET /api/fos/root-causes returns 200 with success', async ({ request }) => {
    const res = await request.get('/api/fos/root-causes');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  test('GET /api/fos/comparison returns 400 without firm params', async ({ request }) => {
    const res = await request.get('/api/fos/comparison');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('firmA');
  });

  test('POST /api/fos/export returns 400 for invalid body', async ({ request }) => {
    const res = await request.post('/api/fos/export', {
      data: { invalid: true },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/fos/export returns PDF for valid body', async ({ request }) => {
    const res = await request.post('/api/fos/export', {
      data: {
        title: 'Test Report',
        filters: {},
        kpis: { totalCases: 100, upheldRate: 0.45, notUpheldRate: 0.55 },
        generatedAt: new Date().toISOString(),
      },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/pdf');
  });
});

test.describe('Smoke tests - dashboard interactions', () => {
  test('Search bar accepts input', async ({ page }) => {
    await page.goto('/workspace');
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test query');
      await expect(searchInput).toHaveValue('test query');
    }
  });

  test('Dashboard loads data and shows case count', async ({ page }) => {
    await page.goto('/workspace');
    await expect(page.getByText(/Showing .* decisions/i)).toBeVisible({ timeout: 30_000 });
  });
});
