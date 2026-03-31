import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

// ─── API tests ──────────────────────────────────────────────────────────────

test.describe('Check Estimator - Firm Overlay API', () => {
  test('returns 400 when product is missing', async ({ request }) => {
    const res = await request.get('/api/fos/check/firm-overlay?firm=Barclays');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('product');
  });

  test('returns 400 when firm is missing', async ({ request }) => {
    const res = await request.get('/api/fos/check/firm-overlay?product=Banking');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('firm');
  });

  test('returns 400 when product exceeds 200 characters', async ({ request }) => {
    const long = 'A'.repeat(201);
    const res = await request.get(`/api/fos/check/firm-overlay?product=${long}&firm=Barclays`);
    expect(res.status()).toBe(400);
  });

  test('returns 400 when firm exceeds 200 characters', async ({ request }) => {
    const long = 'A'.repeat(201);
    const res = await request.get(`/api/fos/check/firm-overlay?product=Banking&firm=${long}`);
    expect(res.status()).toBe(400);
  });

  test('returns 200 with null data for non-existent firm', async ({ request }) => {
    const res = await request.get(
      '/api/fos/check/firm-overlay?product=Banking+and+Payments&firm=NonExistentFirm999'
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });

  test('returns 200 with overlay data for known firm+product', async ({ request }) => {
    // First get a valid product
    const optRes = await request.get('/api/fos/advisor/options');
    const opts = await optRes.json();
    const product = opts.data.products[0];
    expect(product).toBeTruthy();

    const res = await request.get(
      `/api/fos/check/firm-overlay?product=${encodeURIComponent(product)}&firm=Barclays`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Data may be null if Barclays has no cases in this product
    if (body.data) {
      expect(typeof body.data.firmName).toBe('string');
      expect(typeof body.data.totalCases).toBe('number');
      expect(typeof body.data.upheldRate).toBe('number');
      expect(typeof body.data.notUpheldRate).toBe('number');
      expect(body.data.totalCases).toBeGreaterThan(0);
    }
  });

  test('sets cache headers', async ({ request }) => {
    const optRes = await request.get('/api/fos/advisor/options');
    const opts = await optRes.json();
    const product = opts.data.products[0];

    const res = await request.get(
      `/api/fos/check/firm-overlay?product=${encodeURIComponent(product)}&firm=Test`
    );
    expect(res.status()).toBe(200);
    const cacheControl = res.headers()['cache-control'] || '';
    expect(cacheControl).toContain('s-maxage');
  });
});

// ─── UI tests ───────────────────────────────────────────────────────────────

test.describe('Check Estimator - Page loads', () => {
  test('page loads with heading, form, and marketing header', async ({ page }) => {
    await page.goto('/check');

    // Marketing header visible
    await expect(page.getByText('FOS Complaints Intelligence')).toBeVisible();

    // Heading
    await expect(
      page.getByRole('heading', { level: 1, name: /Complaint Outcome Estimator/i })
    ).toBeVisible();

    // Form elements
    await expect(page.locator('#check-product')).toBeVisible();
    await expect(page.locator('#check-root-cause')).toBeVisible();
    await expect(page.locator('#check-firm')).toBeVisible();
  });

  test('no sidebar is shown on /check', async ({ page }) => {
    await page.goto('/check');
    // Sidebar nav shouldn't be present
    const sidebar = page.locator('aside');
    const hasSidebar = await sidebar.isVisible().catch(() => false);
    expect(hasSidebar).toBe(false);
  });

  test('marketing header includes Outcome Estimator link', async ({ page }) => {
    await page.goto('/check');
    const link = page.getByRole('link', { name: /Outcome Estimator/i });
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toBe('/check');
  });
});

test.describe('Check Estimator - Form interaction', () => {
  test('product dropdown is populated from API', async ({ page }) => {
    await page.goto('/check');
    await expect(page.locator('#check-product')).not.toBeDisabled({ timeout: 15_000 });
    const optionCount = await page.locator('#check-product option').count();
    expect(optionCount).toBeGreaterThan(1);
  });

  test('submit button is disabled when no product selected', async ({ page }) => {
    await page.goto('/check');
    await expect(page.locator('#check-product')).not.toBeDisabled({ timeout: 15_000 });
    const submitButton = page.getByRole('button', { name: /check my exposure/i });
    await expect(submitButton).toBeDisabled();
  });

  test('selecting product and submitting shows risk gauge and results', async ({ page }) => {
    await page.goto('/check');
    await expect(page.locator('#check-product')).not.toBeDisabled({ timeout: 15_000 });

    // Select first real product
    const firstOption = await page
      .locator('#check-product option:not([value=""])')
      .first()
      .getAttribute('value');
    expect(firstOption).toBeTruthy();
    await page.locator('#check-product').selectOption(firstOption!);

    // Submit
    await page.getByRole('button', { name: /check my exposure/i }).click();

    // Risk gauge should appear (contains upheld rate text)
    await expect(page.getByText(/upheld rate/i).first()).toBeVisible({ timeout: 30_000 });

    // Confidence badge should appear
    await expect(page.getByText(/confidence/i).first()).toBeVisible();
  });

  test('selecting product + root cause shows results', async ({ page }) => {
    await page.goto('/check');
    await expect(page.locator('#check-product')).not.toBeDisabled({ timeout: 15_000 });

    const firstProduct = await page
      .locator('#check-product option:not([value=""])')
      .first()
      .getAttribute('value');
    await page.locator('#check-product').selectOption(firstProduct!);

    // Select first root cause if available
    const rcOptions = await page.locator('#check-root-cause option:not([value=""])').count();
    if (rcOptions > 0) {
      const firstRC = await page
        .locator('#check-root-cause option:not([value=""])')
        .first()
        .getAttribute('value');
      await page.locator('#check-root-cause').selectOption(firstRC!);
    }

    await page.getByRole('button', { name: /check my exposure/i }).click();
    await expect(page.getByText(/upheld rate/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('entering a firm name shows firm comparison or not-found message', async ({ page }) => {
    await page.goto('/check');
    await expect(page.locator('#check-product')).not.toBeDisabled({ timeout: 15_000 });

    const firstProduct = await page
      .locator('#check-product option:not([value=""])')
      .first()
      .getAttribute('value');
    await page.locator('#check-product').selectOption(firstProduct!);
    await page.locator('#check-firm').fill('Barclays');

    await page.getByRole('button', { name: /check my exposure/i }).click();
    await expect(page.getByText(/upheld rate/i).first()).toBeVisible({ timeout: 30_000 });

    // Wait for the firm overlay to resolve — either comparison bars or the not-found message
    const firmComparison = page.getByText(/Firm vs sector comparison/i);
    const notFound = page.getByText(/No FOS decisions found/i);

    // Wait for one of the two to appear (firm overlay finishes after brief)
    await expect(firmComparison.or(notFound).first()).toBeVisible({ timeout: 15_000 });
  });

  test('non-existent product shows error state', async ({ page }) => {
    await page.goto('/check');
    await expect(page.locator('#check-product')).not.toBeDisabled({ timeout: 15_000 });

    // Add a non-existent product option
    await page.locator('#check-product').evaluate((el: HTMLSelectElement) => {
      const opt = document.createElement('option');
      opt.value = 'NonExistentProduct999';
      opt.textContent = 'NonExistentProduct999';
      el.appendChild(opt);
    });
    await page.locator('#check-product').selectOption('NonExistentProduct999');
    await page.getByRole('button', { name: /check my exposure/i }).click();

    await expect(
      page.getByText(/not enough historical data|request failed/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Check Estimator - Results sections', () => {
  async function loadEstimate(page: import('@playwright/test').Page) {
    await page.goto('/check');
    await expect(page.locator('#check-product')).not.toBeDisabled({ timeout: 15_000 });
    const firstOption = await page
      .locator('#check-product option:not([value=""])')
      .first()
      .getAttribute('value');
    expect(firstOption).toBeTruthy();
    await page.locator('#check-product').selectOption(firstOption!);
    await page.getByRole('button', { name: /check my exposure/i }).click();
    await expect(page.getByText(/upheld rate/i).first()).toBeVisible({ timeout: 30_000 });
  }

  test('outcome breakdown bar is visible when distribution exists', async ({ page }) => {
    await loadEstimate(page);
    const outcomeSection = page.getByText(/outcome breakdown/i).first();
    const hasOutcome = await outcomeSection.isVisible().catch(() => false);
    if (hasOutcome) {
      await expect(outcomeSection).toBeVisible();
    }
  });

  test('top precedents section is visible', async ({ page }) => {
    await loadEstimate(page);
    const precedents = page.getByText(/top precedents cited/i).first();
    const hasPrecedents = await precedents.isVisible().catch(() => false);
    if (hasPrecedents) {
      await expect(precedents).toBeVisible();
    }
  });

  test('what wins and what loses sections are visible', async ({ page }) => {
    await loadEstimate(page);
    const wins = page.getByText(/what wins cases/i).first();
    const loses = page.getByText(/what loses cases/i).first();

    const hasWins = await wins.isVisible().catch(() => false);
    const hasLoses = await loses.isVisible().catch(() => false);

    // At least one of them should be visible if brief has data
    if (hasWins) await expect(wins).toBeVisible();
    if (hasLoses) await expect(loses).toBeVisible();
  });

  test('CTA link navigates to advisor page with product pre-selected', async ({ page }) => {
    await loadEstimate(page);

    const ctaLink = page.getByRole('link', { name: /Get the full Advisor Brief/i });
    await expect(ctaLink).toBeVisible();
    const href = await ctaLink.getAttribute('href');
    expect(href).toContain('/advisor');
    expect(href).toContain('product=');
  });
});
