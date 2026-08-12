import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('platform health separates source date, ingestion, refresh and pipeline state', async ({ request }) => {
  const response = await request.get('/api/fos/health');
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.success).toBe(true);
  expect(payload).toHaveProperty('dataThrough');
  expect(payload).toHaveProperty('lastSuccessfulIngestion');
  expect(payload).toHaveProperty('lastSummaryRefresh');
  expect(payload.pipelineStatus).toMatch(/^(healthy|delayed|stale|running|error)$/);
});

test('two-firm comparison is deterministic and completes within five seconds', async ({ request }) => {
  const directory = await request.get('/api/fos/firms?limit=10');
  expect(directory.status()).toBe(200);
  const firms = (await directory.json()).results.slice(0, 2).map((item: { firm: string }) => item.firm);
  expect(firms).toHaveLength(2);

  const startedAt = Date.now();
  const response = await request.get(`/api/fos/comparison?firm=${encodeURIComponent(firms[0])}&firm=${encodeURIComponent(firms[1])}`);
  const elapsed = Date.now() - startedAt;
  expect(response.status()).toBe(200);
  expect(elapsed).toBeLessThan(5_000);
  const payload = await response.json();
  expect(payload.success).toBe(true);
  expect(payload.data.firms.map((item: { name: string }) => item.name)).toEqual(firms);
});

test('first case page completes within three seconds', async ({ request }) => {
  const startedAt = Date.now();
  const response = await request.get('/api/fos/cases?page=1&pageSize=25');
  const elapsed = Date.now() - startedAt;
  expect(response.status()).toBe(200);
  expect(elapsed).toBeLessThan(3_000);
  const payload = await response.json();
  expect(payload.success).toBe(true);
  expect(Array.isArray(payload.data.cases)).toBe(true);
});

for (const route of ['/advisor', '/comparison']) {
  test(`${route} exposes keyboard-operable mobile navigation`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const menu = page.getByRole('button', { name: 'Open navigation' });
    await menu.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('link', { name: 'Evidence Explorer' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Compare Firms' })).toBeVisible();
  });
}
