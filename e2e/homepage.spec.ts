import { expect, test } from '@playwright/test';

test.describe('Marketing homepage', () => {
  test('guided demo panel switches between product states', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('See live complaint intelligence clearly');
    await expect(page.getByText('Start with live public complaint intelligence.')).toBeVisible();

    await page.getByRole('button', { name: 'Compare' }).click();
    await expect(page.getByText('See how firms and products sit against the wider dataset.')).toBeVisible();

    await page.getByRole('button', { name: 'Work' }).click();
    await expect(page.getByText('Handle complaints in one place once you move into the workspace.')).toBeVisible();

    await page.getByRole('button', { name: 'Report' }).click();
    await expect(page.getByText('Finish with outputs leadership can actually use.')).toBeVisible();
  });
});
