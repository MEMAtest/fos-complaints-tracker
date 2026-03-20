import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

// ─── API tests ──────────────────────────────────────────────────────────────

test.describe('Advisor API - /api/fos/advisor/options', () => {
  test('returns 200 with products and rootCauses arrays', async ({ request }) => {
    const res = await request.get('/api/fos/advisor/options');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.products)).toBe(true);
    expect(Array.isArray(body.data.rootCauses)).toBe(true);
    expect(body.data.products.length).toBeGreaterThan(0);
    expect(body.data.rootCauses.length).toBeGreaterThan(0);
  });

  test('sets cache headers', async ({ request }) => {
    const res = await request.get('/api/fos/advisor/options');
    expect(res.status()).toBe(200);
    const cacheControl = res.headers()['cache-control'] || '';
    expect(cacheControl).toContain('s-maxage');
  });
});

test.describe('Advisor API - /api/fos/advisor', () => {
  test('returns 400 when product is missing', async ({ request }) => {
    const res = await request.get('/api/fos/advisor');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('product');
  });

  test('returns 400 when product is empty', async ({ request }) => {
    const res = await request.get('/api/fos/advisor?product=');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 when product exceeds 200 characters', async ({ request }) => {
    const longProduct = 'A'.repeat(201);
    const res = await request.get(`/api/fos/advisor?product=${longProduct}`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('too long');
  });

  test('returns 404 for non-existent product', async ({ request }) => {
    const res = await request.get('/api/fos/advisor?product=NonExistentProduct12345');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 200 with full brief structure for valid product', async ({ request }) => {
    // Get a valid product first
    const optRes = await request.get('/api/fos/advisor/options');
    const opts = await optRes.json();
    const product = opts.data.products[0];
    expect(product).toBeTruthy();

    const res = await request.get(`/api/fos/advisor?product=${encodeURIComponent(product)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    const brief = body.data;
    // Query echo
    expect(brief.query.product).toBe(product);
    expect(brief.generatedAt).toBeTruthy();

    // Risk assessment
    expect(brief.riskAssessment).toBeDefined();
    expect(typeof brief.riskAssessment.totalCases).toBe('number');
    expect(typeof brief.riskAssessment.upheldRate).toBe('number');
    expect(typeof brief.riskAssessment.notUpheldRate).toBe('number');
    expect(typeof brief.riskAssessment.overallUpheldRate).toBe('number');
    expect(['low', 'medium', 'high', 'very_high']).toContain(brief.riskAssessment.riskLevel);
    expect(['improving', 'stable', 'worsening']).toContain(brief.riskAssessment.trendDirection);
    expect(Array.isArray(brief.riskAssessment.yearTrend)).toBe(true);

    // Collections
    expect(Array.isArray(brief.keyPrecedents)).toBe(true);
    expect(Array.isArray(brief.rootCausePatterns)).toBe(true);
    expect(Array.isArray(brief.vulnerabilities)).toBe(true);
    expect(Array.isArray(brief.sampleCases)).toBe(true);
    expect(Array.isArray(brief.recommendedActions)).toBe(true);
  });

  test('returns brief with rootCause filter', async ({ request }) => {
    const optRes = await request.get('/api/fos/advisor/options');
    const opts = await optRes.json();
    const product = opts.data.products.find((p: string) => p === 'Banking and Payments') || opts.data.products[0];
    const rootCause = opts.data.rootCauses[0];

    const res = await request.get(
      `/api/fos/advisor?product=${encodeURIComponent(product)}&rootCause=${encodeURIComponent(rootCause)}`
    );
    // Should return either 200 (brief found) or 404 (no brief for combo, falls back to product-level)
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.riskAssessment).toBeDefined();
    }
  });

  test('returns 400 when rootCause exceeds 200 characters', async ({ request }) => {
    const optRes = await request.get('/api/fos/advisor/options');
    const opts = await optRes.json();
    const product = opts.data.products[0];
    const longRC = 'X'.repeat(201);
    const res = await request.get(
      `/api/fos/advisor?product=${encodeURIComponent(product)}&rootCause=${longRC}`
    );
    expect(res.status()).toBe(400);
  });

  test('returns 400 when freeText exceeds 5000 characters', async ({ request }) => {
    const optRes = await request.get('/api/fos/advisor/options');
    const opts = await optRes.json();
    const product = opts.data.products[0];
    const longText = 'Z'.repeat(5001);
    const res = await request.get(
      `/api/fos/advisor?product=${encodeURIComponent(product)}&freeText=${encodeURIComponent(longText)}`
    );
    expect(res.status()).toBe(400);
  });
});

// ─── UI tests ───────────────────────────────────────────────────────────────

test.describe('Advisor UI - page and form', () => {
  test('advisor page loads with heading and form', async ({ page }) => {
    await page.goto('/advisor');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('Complaint Advisor');
    await expect(page.locator('#advisor-product')).toBeVisible();
    await expect(page.locator('#advisor-root-cause')).toBeVisible();
  });

  test('product dropdown is populated from API', async ({ page }) => {
    await page.goto('/advisor');
    // Wait for options to load (dropdown will no longer say "Loading products...")
    await expect(page.locator('#advisor-product')).not.toBeDisabled({ timeout: 15_000 });
    const optionCount = await page.locator('#advisor-product option').count();
    // At least the placeholder + 1 real product
    expect(optionCount).toBeGreaterThan(1);
  });

  test('submit button is disabled when no product selected', async ({ page }) => {
    await page.goto('/advisor');
    await expect(page.locator('#advisor-product')).not.toBeDisabled({ timeout: 15_000 });
    const submitButton = page.getByRole('button', { name: /get intelligence/i });
    await expect(submitButton).toBeDisabled();
  });

  test('selecting a product and submitting shows brief', async ({ page }) => {
    await page.goto('/advisor');
    await expect(page.locator('#advisor-product')).not.toBeDisabled({ timeout: 15_000 });

    // Select first real product
    const firstOption = await page.locator('#advisor-product option:not([value=""])').first().getAttribute('value');
    expect(firstOption).toBeTruthy();
    await page.locator('#advisor-product').selectOption(firstOption!);

    // Submit
    await page.getByRole('button', { name: /get intelligence/i }).click();

    // Wait for brief to load — risk assessment card should appear
    await expect(page.getByText(/total cases/i).first()).toBeVisible({ timeout: 30_000 });

    // Brief sections should be visible
    await expect(page.getByText(/key precedents/i).first()).toBeVisible();
    await expect(page.getByText(/root cause patterns/i).first()).toBeVisible();
    await expect(page.getByText(/sample decisions/i).first()).toBeVisible();
    await expect(page.getByText(/recommended actions/i).first()).toBeVisible();
  });

  test('submitting with non-existent product shows error or empty state', async ({ page }) => {
    await page.goto('/advisor');
    await expect(page.locator('#advisor-product')).not.toBeDisabled({ timeout: 15_000 });

    // Manually set a non-existent value by adding option dynamically
    await page.locator('#advisor-product').evaluate((el: HTMLSelectElement) => {
      const opt = document.createElement('option');
      opt.value = 'NonExistentProduct999';
      opt.textContent = 'NonExistentProduct999';
      el.appendChild(opt);
    });
    await page.locator('#advisor-product').selectOption('NonExistentProduct999');
    await page.getByRole('button', { name: /get intelligence/i }).click();

    // Should show error message or empty state
    await expect(
      page.getByText(/no.*intelligence brief|no.*available/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
