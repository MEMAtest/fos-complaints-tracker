import { expect, test } from '@playwright/test';

test.describe('Marketing homepage', () => {
  test('capability carousel switches between firm tasks', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Public FOS intelligence');
    await expect(page.getByRole('link', { name: /explore the data/i }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: /What firms can do/i })).toBeVisible();

    await page.getByRole('tab', { name: 'Compare firms' }).click();
    await expect(page.getByText('See the complaint pattern in context.')).toBeVisible();

    await page.getByRole('tab', { name: 'Manage complaints' }).click();
    await expect(page.getByText('Transition into the workspace when the complaint needs handling depth.')).toBeVisible();

    await page.getByRole('tab', { name: 'Create reports' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Finish with outputs leadership can actually use.' })).toBeVisible();

    await page.getByRole('button', { name: 'Previous capability' }).click();
    await expect(page.getByRole('tab', { name: 'Manage complaints' })).toHaveAttribute('aria-selected', 'true');
  });

  test('phase grid and role split sections render', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Move from public complaint signal to operational workflow/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /See how different roles benefit/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /request workspace demo/i }).first()).toBeVisible();
  });

  test('header and public workflow links resolve to live pages or workspace entry', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('banner');

    await expect(header.getByRole('link', { name: 'Evidence Explorer' })).toHaveAttribute('href', '/insights');
    await expect(header.getByRole('link', { name: 'Outcome Estimator' })).toHaveAttribute('href', '/check');
    await expect(header.getByRole('link', { name: 'Management platform' })).toHaveAttribute('href', '/workspace');
    await expect(header.getByRole('link', { name: 'Compare Firms' })).toHaveAttribute('href', '/comparison');

    await expect(page.getByRole('link', { name: 'Open complaints flow' })).toHaveAttribute('href', '/complaints');
    await expect(page.getByRole('link', { name: 'See reporting flow' }).first()).toHaveAttribute('href', '/board-pack');
  });
});
