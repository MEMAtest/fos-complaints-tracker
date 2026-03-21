import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('public insights pages render without auth and expose crawl surfaces', async ({ page, request }) => {
  await page.goto('/insights');
  await expect(page.getByRole('heading', { name: /Search-friendly ombudsman complaint analysis/i })).toBeVisible();

  await page.goto('/insights/years');
  await expect(page.getByRole('heading', { name: /Annual ombudsman complaint analysis/i })).toBeVisible();

  await page.goto('/insights/year/2025');
  await expect(page.getByRole('heading', { name: /2025 complaint and ombudsman analysis/i })).toBeVisible();
  await expect(page.getByText('Representative cases', { exact: true })).toBeVisible();

  await page.goto('/insights/firm/lloyds-bank-plc');
  await expect(page.getByRole('heading', { name: /Lloyds Bank PLC complaint analysis/i })).toBeVisible();

  await page.goto('/insights/product/banking-and-credit');
  await expect(page.getByRole('heading', { name: /Banking and credit complaint analysis/i })).toBeVisible();

  await page.goto('/insights/type/delay-in-claim-handling');
  await expect(page.getByRole('heading', { name: /Delay in claim handling complaint theme analysis/i })).toBeVisible();

  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('/insights');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain('/insights/year/2025');
});
