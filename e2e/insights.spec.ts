import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('public insights pages render without auth', async ({ page }) => {
  test.slow();
  const goto = (href: string) => page.goto(href, { waitUntil: 'domcontentloaded' });

  await goto('/insights');
  await expect(page.getByRole('heading', { name: /Search-friendly ombudsman complaint analysis by year, firm, product, theme, and curated cross-section/i })).toBeVisible();

  await goto('/insights/years');
  await expect(page.getByRole('heading', { name: /Annual ombudsman complaint analysis/i })).toBeVisible();

  await goto('/insights/year-products');
  await expect(page.getByRole('heading', { name: /Year and product complaint analysis/i })).toBeVisible();

  await goto('/insights/firm-products');
  await expect(page.getByRole('heading', { name: /Firm and product complaint analysis/i })).toBeVisible();

  await goto('/insights/year/2025');
  await expect(page.getByRole('heading', { name: /2025 complaint and ombudsman analysis/i })).toBeVisible();
  await expect(page.getByText('Representative cases', { exact: true })).toBeVisible();

  await goto('/insights/year/2025/product/banking-and-payments');
  await expect(page.getByRole('heading', { level: 1, name: /Banking and Payments complaints in 2025/i })).toBeVisible();

  await goto('/insights/firm/lloyds-bank-plc');
  await expect(page.getByRole('heading', { name: /Lloyds Bank PLC complaint analysis/i })).toBeVisible();

  await goto('/insights/firm/lloyds-bank-plc/product/payment-protection-insurance-ppi');
  await expect(page.getByRole('heading', { level: 1, name: /Lloyds Bank PLC in Payment protection insurance \(PPI\)/i })).toBeVisible();

  await goto('/insights/product/banking-and-credit');
  await expect(page.getByRole('heading', { name: /Banking and credit complaint analysis/i })).toBeVisible();

  await goto('/insights/type/delay-in-claim-handling');
  await expect(page.getByRole('heading', { name: /Delay in claim handling complaint theme analysis/i })).toBeVisible();
});

test('public insight crawl surfaces include the new cross-pages', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('/insights');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain('/insights/year/2025');
  expect(xml).toContain('/insights/year/2025/product/banking-and-payments');
  expect(xml).toContain('/insights/firm/lloyds-bank-plc/product/payment-protection-insurance-ppi');
});
