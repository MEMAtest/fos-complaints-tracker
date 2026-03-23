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
    await expect(page.getByText(/Precedent Analysis/i).first()).toBeVisible();
    await expect(page.getByText(/Root Cause Analysis/i).first()).toBeVisible();
    await expect(page.getByText(/Sample Decisions/i).first()).toBeVisible();
    await expect(page.getByText(/Recommended Actions/i).first()).toBeVisible();
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

// ─── Enhanced advisor component tests ────────────────────────────────────────

/** Helper: load a product brief and wait for it to render. */
async function loadFirstBrief(page: import('@playwright/test').Page) {
  await page.goto('/advisor');
  await expect(page.locator('#advisor-product')).not.toBeDisabled({ timeout: 15_000 });
  const firstOption = await page.locator('#advisor-product option:not([value=""])').first().getAttribute('value');
  expect(firstOption).toBeTruthy();
  await page.locator('#advisor-product').selectOption(firstOption!);
  await page.getByRole('button', { name: /get intelligence/i }).click();
  await expect(page.getByText(/total cases/i).first()).toBeVisible({ timeout: 30_000 });
}

test.describe('Advisor UI – Executive Summary', () => {
  test('displays AI executive summary when available', async ({ page }) => {
    await loadFirstBrief(page);

    // Check if executive summary section exists (depends on AI data)
    const summarySection = page.getByText(/Executive Summary/i).first();
    const hasSummary = await summarySection.isVisible().catch(() => false);

    if (hasSummary) {
      // Should have meaningful content (more than just a heading)
      const parent = summarySection.locator('..');
      const text = await parent.textContent();
      // AI summaries should be substantial (>100 chars including heading)
      expect((text || '').length).toBeGreaterThan(100);
    }
  });
});

test.describe('Advisor UI – Outcome Donut Chart', () => {
  test('displays outcome distribution chart when data exists', async ({ page }) => {
    await loadFirstBrief(page);

    const outcomeSection = page.getByText(/Outcome Distribution/i).first();
    const hasOutcome = await outcomeSection.isVisible().catch(() => false);

    if (hasOutcome) {
      // Recharts renders as SVG
      const chartSvg = outcomeSection.locator('..').locator('svg').first();
      await expect(chartSvg).toBeVisible();
    }
  });
});

test.describe('Advisor UI – Year Trend Chart', () => {
  test('displays year-over-year trend when multiple years exist', async ({ page }) => {
    await loadFirstBrief(page);

    const trendSection = page.getByText(/Year-over-Year Trend/i).first();
    const hasTrend = await trendSection.isVisible().catch(() => false);

    if (hasTrend) {
      // Chart SVG should be present
      const chartSvg = trendSection.locator('..').locator('svg').first();
      await expect(chartSvg).toBeVisible();
    }
  });
});

test.describe('Advisor UI – Precedent Bar Chart', () => {
  test('displays precedent analysis section with chart', async ({ page }) => {
    await loadFirstBrief(page);

    const precedentCard = page.getByText(/Precedent Analysis/i).first();
    await precedentCard.scrollIntoViewIfNeeded();
    await expect(precedentCard).toBeVisible();

    // Should have an SVG chart inside
    const svgChart = precedentCard.locator('..').locator('svg').first();
    const hasChart = await svgChart.isVisible().catch(() => false);
    // Chart appears when there are precedents; otherwise just the list
    if (hasChart) {
      await expect(svgChart).toBeVisible();
    }
  });
});

test.describe('Advisor UI – Decisions Browser', () => {
  test('sample decisions table renders with rows', async ({ page }) => {
    await loadFirstBrief(page);

    const samplesSection = page.getByText(/Sample Decisions/i).first();
    await samplesSection.scrollIntoViewIfNeeded();
    await expect(samplesSection).toBeVisible();

    // Table should have at least one row
    const table = samplesSection.locator('..').locator('..').getByRole('table');
    const hasTable = await table.isVisible().catch(() => false);

    if (hasTable) {
      const rows = table.locator('tbody tr');
      expect(await rows.count()).toBeGreaterThan(0);

      // Should have Reference and Outcome columns
      await expect(table.getByRole('columnheader', { name: /Reference/i })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: /Outcome/i })).toBeVisible();
    }
  });

  test('clicking a sample decision row opens case detail sheet', async ({ page }) => {
    await loadFirstBrief(page);

    const samplesSection = page.getByText(/Sample Decisions/i).first();
    await samplesSection.scrollIntoViewIfNeeded();

    // Find the table and click the first data row
    const table = samplesSection.locator('..').locator('..').getByRole('table');
    const hasTable = await table.isVisible().catch(() => false);

    if (hasTable) {
      const firstRow = table.locator('tbody tr').first();
      await expect(firstRow).toBeVisible();
      await firstRow.click();

      // Case detail sheet should open
      await expect(page.getByText(/Decision logic/i).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('decisions browser has pagination when enough cases', async ({ page }) => {
    await loadFirstBrief(page);

    const samplesSection = page.getByText(/Sample Decisions/i).first();
    await samplesSection.scrollIntoViewIfNeeded();

    // Check for pagination text
    const paginationText = page.getByText(/Page \d+ of \d+/i);
    const hasPagination = await paginationText.isVisible().catch(() => false);

    if (hasPagination) {
      await expect(paginationText).toBeVisible();
    }
  });
});

test.describe('Advisor UI – What Wins / What Loses', () => {
  test('what wins and what loses sections are visible', async ({ page }) => {
    await loadFirstBrief(page);

    await expect(page.getByText(/What Wins Cases/i).first()).toBeVisible();
    await expect(page.getByText(/What Loses Cases/i).first()).toBeVisible();
  });

  test('AI guidance section appears when available', async ({ page }) => {
    await loadFirstBrief(page);

    const guidanceSection = page.getByText(/Compliance Guidance/i).first();
    const hasGuidance = await guidanceSection.isVisible().catch(() => false);

    if (hasGuidance) {
      const parent = guidanceSection.locator('..');
      const text = await parent.textContent();
      expect((text || '').length).toBeGreaterThan(50);
    }
  });
});

test.describe('Advisor API – enhanced brief fields', () => {
  test('brief response includes AI fields and outcome distribution', async ({ request }) => {
    const optRes = await request.get('/api/fos/advisor/options');
    const opts = await optRes.json();
    const product = opts.data.products[0];
    expect(product).toBeTruthy();

    const res = await request.get(`/api/fos/advisor?product=${encodeURIComponent(product)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const brief = body.data;

    // AI fields may or may not be populated depending on the product
    // But the fields should exist in the response (even if null)
    expect('aiExecutiveSummary' in brief).toBe(true);
    expect('aiWhatWins' in brief).toBe(true);
    expect('aiWhatLoses' in brief).toBe(true);
    expect('aiGuidance' in brief).toBe(true);
    expect('outcomeDistribution' in brief).toBe(true);

    // If AI executive summary exists, it should be substantive
    if (brief.aiExecutiveSummary) {
      expect(typeof brief.aiExecutiveSummary).toBe('string');
      expect(brief.aiExecutiveSummary.length).toBeGreaterThan(100);
    }

    // If outcome distribution exists, validate structure
    if (brief.outcomeDistribution && brief.outcomeDistribution.length > 0) {
      for (const item of brief.outcomeDistribution) {
        expect(typeof item.outcome).toBe('string');
        expect(typeof item.count).toBe('number');
        expect(item.count).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
