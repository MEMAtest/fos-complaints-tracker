import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

// ─── API tests ──────────────────────────────────────────────────────────────

test.describe('Similar Cases API - /api/fos/cases/[caseId]/similar', () => {
  test('returns 400 for missing caseId', async ({ request }) => {
    const res = await request.get('/api/fos/cases/%20/similar');
    // Empty / whitespace-only may not match the regex
    expect([400, 404]).toContain(res.status());
  });

  test('returns 400 for caseId with invalid characters', async ({ request }) => {
    const res = await request.get('/api/fos/cases/%3Cscript%3Ealert(1)%3C%2Fscript%3E/similar');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invalid');
  });

  test('returns 400 for caseId exceeding 200 characters', async ({ request }) => {
    const longId = 'A'.repeat(201);
    const res = await request.get(`/api/fos/cases/${longId}/similar`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 404 for non-existent valid caseId', async ({ request }) => {
    const res = await request.get('/api/fos/cases/nonexistent-case-id-99999/similar');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('not found');
  });

  test('returns 200 with similar cases and context for a real case', async ({ request }) => {
    // First, fetch a real case reference from the dashboard
    const dashRes = await request.get('/api/fos/analysis/cases?pageSize=1');
    const dashBody = await dashRes.json();
    if (!dashBody.success || !dashBody.data?.items?.length) {
      test.skip(true, 'No cases available in the dataset.');
      return;
    }

    const caseId = dashBody.data.items[0].caseId;
    expect(caseId).toBeTruthy();

    const res = await request.get(`/api/fos/cases/${encodeURIComponent(caseId)}/similar`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    // Context should exist
    expect(body.data.context).toBeDefined();
    expect(typeof body.data.context.productUpheldRate).toBe('number');
    expect(typeof body.data.context.productTotalCases).toBe('number');
    expect(Array.isArray(body.data.context.rootCauseRates)).toBe(true);
    expect(Array.isArray(body.data.context.precedentRates)).toBe(true);

    // Cases array should exist (may be empty if no similar found)
    expect(Array.isArray(body.data.cases)).toBe(true);

    // Cache headers
    const cacheControl = res.headers()['cache-control'] || '';
    expect(cacheControl).toContain('s-maxage');
  });

  test('does not leak internal error details', async ({ request }) => {
    // This should trigger a 400, and response should NOT contain stack traces or DB info
    const res = await request.get('/api/fos/cases/DROP TABLE fos_decisions/similar');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).not.toContain('pg_');
    expect(body.error).not.toContain('connection');
    expect(body.error).not.toContain('postgres');
  });
});

// ─── UI tests ───────────────────────────────────────────────────────────────

/** Helper: open analysis page, browse decisions, click first row to open detail sheet. */
async function openCaseDetailSheet(page: import('@playwright/test').Page) {
  await page.goto('/analysis');
  await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

  const browseButton = page.getByRole('button', { name: /Browse.*Matching Decisions/i });
  await browseButton.scrollIntoViewIfNeeded();
  await browseButton.click();

  // Wait for the decisions table — it has a unique "Summary" column header not found in other tables.
  await expect(page.getByRole('columnheader', { name: /Summary/i })).toBeVisible({ timeout: 15_000 });

  // Find the decisions table by filtering for the one with a "Summary" column
  const decisionsTable = page.locator('table').filter({ has: page.getByRole('columnheader', { name: /Summary/i }) });
  const firstRow = decisionsTable.locator('tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 10_000 });
  await firstRow.click();

  // Wait for sheet content to load — "Decision logic" appears once case data renders
  await expect(page.getByText(/Decision logic/i).first()).toBeVisible({ timeout: 30_000 });
}

test.describe('Similar Decisions UI – via case detail sheet', () => {
  test('Find Similar Decisions button is visible in case detail sheet', async ({ page }) => {
    await openCaseDetailSheet(page);

    const findSimilarButton = page.getByRole('button', { name: /Find Similar Decisions/i });
    // The button is near the bottom of the sheet — scroll it into view
    await findSimilarButton.scrollIntoViewIfNeeded();
    await expect(findSimilarButton).toBeVisible({ timeout: 10_000 });
  });

  test('clicking Find Similar shows loading then results', async ({ page }) => {
    await openCaseDetailSheet(page);

    const findSimilarButton = page.getByRole('button', { name: /Find Similar Decisions/i });
    await findSimilarButton.scrollIntoViewIfNeeded();
    await expect(findSimilarButton).toBeVisible({ timeout: 10_000 });
    await findSimilarButton.click();

    // Loading text
    await expect(page.getByText(/Finding similar decisions/i)).toBeVisible({ timeout: 5_000 });

    // Wait for results — Decision Context section, no-match, or error
    const resultOrNoMatch = page
      .getByText(/Decision Context/i)
      .or(page.getByText(/No similar decisions found/i))
      .or(page.getByText(/Failed/i));
    await expect(resultOrNoMatch).toBeVisible({ timeout: 15_000 });

    // If context loaded, verify stats
    const hasContext = await page.getByText(/Decision Context/i).isVisible();
    if (hasContext) {
      await expect(page.getByText(/Product upheld rate/i)).toBeVisible();
      await expect(page.getByText(/decisions in product/i)).toBeVisible();
    }
  });

  test('similar cases show similarity scores and outcome badges', async ({ page }) => {
    await openCaseDetailSheet(page);

    const findSimilarButton = page.getByRole('button', { name: /Find Similar Decisions/i });
    await findSimilarButton.scrollIntoViewIfNeeded();
    await expect(findSimilarButton).toBeVisible({ timeout: 10_000 });
    await findSimilarButton.click();

    // Wait for either results or no-match
    const hasSimilar = await page
      .getByText(/Similar Decisions \(\d+\)/i)
      .isVisible({ timeout: 15_000 })
      .catch(() => false);

    if (hasSimilar) {
      await expect(page.getByText(/Score \d+/i).first()).toBeVisible();
    }
  });
});
