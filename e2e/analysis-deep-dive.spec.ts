import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

// ─── Outcome filter bar ─────────────────────────────────────────────────────

test.describe('Analysis page – outcome filter bar', () => {
  test('outcome filter buttons are visible on load', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

    // All four outcome buttons should render
    await expect(page.getByRole('button', { name: /^Upheld$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Not Upheld$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Partially Upheld$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Settled$/i })).toBeVisible();
  });

  test('clicking an outcome filter shows a filter pill and refreshes data', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

    // Click "Upheld" button
    await page.getByRole('button', { name: /^Upheld$/i }).click();

    // Filter pill should appear
    await expect(page.getByText(/Outcome: Upheld/i)).toBeVisible({ timeout: 15_000 });

    // Data should refresh — "Decisions in scope" KPI remains visible
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('outcome pill can be removed to clear filter', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

    // Toggle one outcome
    await page.getByRole('button', { name: /^Upheld$/i }).click();
    const pill = page.getByText(/Outcome: Upheld/i);
    await expect(pill).toBeVisible({ timeout: 15_000 });

    // Click the pill to remove the filter (the whole pill is a clickable clear button)
    await pill.click();

    // Pill should disappear
    await expect(pill).not.toBeVisible({ timeout: 10_000 });
  });
});

// ─── Deep analysis section visibility ────────────────────────────────────────

test.describe('Analysis page – deep analysis section', () => {
  test('deep analysis section appears when data is loaded', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

    // Heading and description should appear
    const section = page.getByRole('heading', { name: 'Deep Analysis', exact: true });
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();

    await expect(page.getByText(/Generate an AI-powered analysis/i)).toBeVisible();
  });

  test('Analyse This Subset button shows case count and is enabled when ≥5 decisions', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

    const analyseButton = page.getByRole('button', { name: /Analyse This Subset/i });
    await analyseButton.scrollIntoViewIfNeeded();
    await expect(analyseButton).toBeVisible();
    await expect(analyseButton).toBeEnabled();

    // Should display the decision count
    const buttonText = await analyseButton.textContent();
    expect(buttonText).toMatch(/\d+.*decisions/i);
  });
});

// ─── AI subset synthesis ─────────────────────────────────────────────────────

test.describe('Analysis page – AI subset synthesis', () => {
  test('clicking Analyse This Subset shows loading then AI narrative', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

    // Apply a year filter to scope down the subset (faster Groq response)
    const yearButtons = page.locator('button').filter({ hasText: /^20\d{2}$/ });
    const yearCount = await yearButtons.count();
    if (yearCount > 0) {
      await yearButtons.last().click();
      // Wait for data refresh
      await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });
    }

    const analyseButton = page.getByRole('button', { name: /Analyse This Subset/i });
    await analyseButton.scrollIntoViewIfNeeded();
    await analyseButton.click();

    // Loading state should appear
    await expect(page.getByText(/Analysing .* decisions with AI/i)).toBeVisible({ timeout: 5_000 });

    // Wait for result — AI narrative or error (Groq may be rate-limited)
    const resultOrError = page.getByText(/AI Deep Analysis/i).or(page.getByText(/Retry/i));
    await expect(resultOrError).toBeVisible({ timeout: 30_000 });

    // If synthesis succeeded, verify narrative sections
    const hasNarrative = await page.getByText(/AI Deep Analysis/i).isVisible();
    if (hasNarrative) {
      // Badge with stats
      await expect(page.getByText(/decisions ·.*upheld/i).first()).toBeVisible();

      // Charts should render
      await expect(page.getByRole('heading', { name: /Top Root Causes/i })).toBeVisible();
    }
  });

  test('filter change resets the analysis state', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

    const analyseButton = page.getByRole('button', { name: /Analyse This Subset/i });
    await analyseButton.scrollIntoViewIfNeeded();
    await analyseButton.click();

    // Wait for loading to start
    await expect(page.getByText(/Analysing .* decisions with AI/i).or(page.getByText(/AI Deep Analysis/i))).toBeVisible({ timeout: 30_000 });

    // Now change a filter — toggle an outcome
    await page.getByRole('button', { name: /^Upheld$/i }).click();

    // The analyse button should reappear (analysis state reset)
    await expect(page.getByRole('button', { name: /Analyse This Subset/i })).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Subset decisions table ──────────────────────────────────────────────────

test.describe('Analysis page – subset decisions table', () => {
  test('Browse Matching Decisions button loads a table', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

    // Find and click the browse button
    const browseButton = page.getByRole('button', { name: /Browse.*Matching Decisions/i });
    await browseButton.scrollIntoViewIfNeeded();
    await expect(browseButton).toBeVisible();
    await browseButton.click();

    // Table heading should appear
    await expect(page.getByText(/Matching Decisions/i).first()).toBeVisible({ timeout: 15_000 });

    // Table should have expected column headers
    await expect(page.getByRole('columnheader', { name: /Reference/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Date/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Outcome/i })).toBeVisible();

    // At least one data row should exist (use decisions table, which has "Summary" column)
    const decisionsTable = page.locator('table').filter({ has: page.getByRole('columnheader', { name: /Summary/i }) });
    const rows = decisionsTable.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('decisions table shows pagination controls', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

    const browseButton = page.getByRole('button', { name: /Browse.*Matching Decisions/i });
    await browseButton.scrollIntoViewIfNeeded();
    await browseButton.click();

    await expect(page.getByText(/Matching Decisions/i).first()).toBeVisible({ timeout: 15_000 });

    // Pagination "Page X of Y" text
    await expect(page.getByText(/Page \d+ of \d+/i)).toBeVisible();

    // Total count
    await expect(page.getByText(/\d+ total/)).toBeVisible();
  });

  test('clicking a table row opens the case detail sheet', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

    const browseButton = page.getByRole('button', { name: /Browse.*Matching Decisions/i });
    await browseButton.scrollIntoViewIfNeeded();
    await browseButton.click();

    // Wait for decisions table (has "Summary" column, unique to this table)
    await expect(page.getByRole('columnheader', { name: /Summary/i })).toBeVisible({ timeout: 15_000 });
    const decisionsTable = page.locator('table').filter({ has: page.getByRole('columnheader', { name: /Summary/i }) });
    const firstRow = decisionsTable.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });

    // Click the first row
    await firstRow.click();

    // Case detail sheet should open
    await expect(page.getByText(/Decision logic/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Smart tags/i)).toBeVisible();
  });

  test('pagination navigates between pages', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByText(/Decisions in scope/i).first()).toBeVisible({ timeout: 30_000 });

    const browseButton = page.getByRole('button', { name: /Browse.*Matching Decisions/i });
    await browseButton.scrollIntoViewIfNeeded();
    await browseButton.click();

    await expect(page.getByText(/Page 1 of/i)).toBeVisible({ timeout: 15_000 });

    // Check if there are multiple pages
    const pageText = await page.getByText(/Page 1 of \d+/i).textContent();
    const totalPages = parseInt((pageText || '').replace(/.*of\s+/, ''), 10);

    if (totalPages > 1) {
      // Click next page button (ChevronRight icon button)
      const nextButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') });
      await expect(nextButton).toBeEnabled();
      await nextButton.click();

      // Should show page 2
      await expect(page.getByText(/Page 2 of/i)).toBeVisible({ timeout: 10_000 });
    }
  });
});
