import { expect, test } from '@playwright/test';

test.describe('Marketing homepage', () => {
  test('guided demo panel switches between product states', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('See live complaint intelligence clearly');
    await expect(page.getByRole('link', { name: /start analysis/i }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Compare' }).click();
    await expect(page.getByText('See the complaint pattern in context.')).toBeVisible();

    await page.getByRole('button', { name: 'Work' }).click();
    await expect(page.getByText('Transition into the workspace when the complaint needs handling depth.')).toBeVisible();

    await page.getByRole('button', { name: 'Report' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Finish with outputs leadership can actually use.' })).toBeVisible();
  });

  test('phase grid and role split sections render', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Move from public complaint signal to operational workflow/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /See how different roles benefit/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /request workspace demo/i }).first()).toBeVisible();
  });
});
