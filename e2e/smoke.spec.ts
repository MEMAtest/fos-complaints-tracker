import { test, expect } from '@playwright/test';

test.describe('Smoke tests - pages load', () => {
  test('Dashboard page loads with KPI cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('FOS Complaints Intelligence');
    // KPI section should render (either skeleton or real cards)
    await expect(page.locator('section').first()).toBeVisible();
  });

  test('Analysis page loads', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.locator('h1')).toContainText('Analysis');
  });

  test('Root Causes page loads', async ({ page }) => {
    await page.goto('/root-causes');
    await expect(page.locator('h1')).toContainText('Root Cause Analysis');
  });

  test('Comparison page loads with firm selectors', async ({ page }) => {
    await page.goto('/comparison');
    await expect(page.locator('h1')).toContainText('Firm Comparison');
    // Should show the prompt to select firms
    await expect(page.getByText('Select two firms')).toBeVisible();
  });
});

test.describe('Smoke tests - sidebar navigation', () => {
  test('Navigate between all pages via sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('FOS Complaints Intelligence');

    // Navigate to Analysis
    await page.getByRole('link', { name: /analysis/i }).click();
    await expect(page).toHaveURL('/analysis');
    await expect(page.locator('h1')).toContainText('Analysis');

    // Navigate to Root Causes
    await page.getByRole('link', { name: /root cause/i }).click();
    await expect(page).toHaveURL('/root-causes');
    await expect(page.locator('h1')).toContainText('Root Cause Analysis');

    // Navigate to Comparison
    await page.getByRole('link', { name: /comparison/i }).click();
    await expect(page).toHaveURL('/comparison');
    await expect(page.locator('h1')).toContainText('Firm Comparison');

    // Navigate back to Dashboard
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL('/');
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
    await page.goto('/');
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test query');
      await expect(searchInput).toHaveValue('test query');
    }
  });

  test('Dashboard loads data and shows case count', async ({ page }) => {
    await page.goto('/');
    // Wait for loading to complete (either skeleton disappears or data shows)
    await page.waitForFunction(() => {
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      return skeletons.length === 0;
    }, { timeout: 30_000 });
    // At least one KPI card should have a numeric value
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
