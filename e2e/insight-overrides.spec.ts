import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('admin can manage insight publication overrides', async ({ page }) => {
  await page.goto('/settings/insights');
  await expect(page).toHaveURL(/\/login\?next=/);

  await page.locator('input[type="email"]').fill('admin@local.test');
  await page.locator('input[type="password"]').fill('AdminPass123!');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/settings\/insights$/);
  await expect(page.getByRole('heading', { level: 1, name: /Insight publication controls/i })).toBeVisible();

  const search = page.getByPlaceholder(/Search titles, summaries, or entity keys/i);
  await search.fill('Banking and Payments complaints in 2025');
  await expect(page.getByRole('button', { name: /Banking and Payments complaints in 2025/i }).first()).toBeVisible();
  await page.getByRole('button', { name: /Banking and Payments complaints in 2025/i }).first().click();

  const noindex = page.getByLabel(/Noindex this page/i);
  await noindex.check();
  await page.getByLabel(/Featured rank/i).fill('1');
  await page.getByRole('button', { name: /Save override/i }).click();
  await expect(page.getByText('Override saved.')).toBeVisible();

  await page.getByRole('button', { name: /Clear override/i }).click();
  await expect(page.getByText('Override removed.')).toBeVisible();
});
