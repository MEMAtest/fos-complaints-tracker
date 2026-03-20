import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('protected complaints workspace requires sign-in and supports operator login', async ({ page }) => {
  await page.goto('/complaints');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByText('Workspace sign in')).toBeVisible();

  await page.locator('input[type="email"]').fill('operator@local.test');
  await page.locator('input[type="password"]').fill('OperatorPass123!');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/complaints$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('Complaints Workspace');
  await expect(page.getByText(/Workspace Operator/i)).toBeVisible();
});
