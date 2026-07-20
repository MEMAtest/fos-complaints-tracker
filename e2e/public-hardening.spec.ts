import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('public synthesis applies a fixed-window request limit', async ({ request }) => {
  const clientId = `e2e-synthesis-${Date.now()}`;
  const payload = {
    filters: {
      years: [],
      outcomes: [],
      products: ['No such product'],
      firms: [],
      tags: [],
      query: '',
    },
  };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await request.post('/api/fos/analysis/synthesise', {
      data: payload,
      headers: { 'x-forwarded-for': clientId },
    });
    expect(response.status()).toBe(400);
  }

  const limited = await request.post('/api/fos/analysis/synthesise', {
    data: payload,
    headers: { 'x-forwarded-for': clientId },
  });
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0);
  await expect(limited.json()).resolves.toMatchObject({
    success: false,
    error: expect.stringContaining('Too many analysis requests'),
  });
});

test('public export rejects invalid and excessive input', async ({ request }) => {
  const invalidKpis = await request.post('/api/fos/export', {
    data: {
      title: 'Invalid report',
      filters: {},
      kpis: { totalCases: 10, upheldRate: 150, notUpheldRate: -1 },
      generatedAt: new Date().toISOString(),
    },
  });
  expect(invalidKpis.status()).toBe(400);

  const excessiveFilters = Object.fromEntries(
    Array.from({ length: 21 }, (_, index) => [`filter${index}`, `value${index}`])
  );
  const tooManyFilters = await request.post('/api/fos/export', {
    data: {
      title: 'Oversized report',
      filters: excessiveFilters,
      kpis: { totalCases: 10, upheldRate: 0.5, notUpheldRate: 0.5 },
      generatedAt: new Date().toISOString(),
    },
  });
  expect(tooManyFilters.status()).toBe(400);
});

test('public JSON endpoints reject bodies above 64 KB', async ({ request }) => {
  const oversized = 'x'.repeat(70 * 1024);
  const synthesis = await request.post('/api/fos/analysis/synthesise', {
    data: { filters: {}, padding: oversized },
  });
  expect(synthesis.status()).toBe(413);

  const exportResponse = await request.post('/api/fos/export', {
    data: {
      title: oversized,
      filters: {},
      kpis: { totalCases: 10, upheldRate: 0.5, notUpheldRate: 0.5 },
      generatedAt: new Date().toISOString(),
    },
  });
  expect(exportResponse.status()).toBe(413);
});

test('public export sanitises unsupported PDF characters', async ({ request }) => {
  const response = await request.post('/api/fos/export', {
    data: {
      title: 'Report with emoji 🔒 and\nnew line',
      filters: { product: ['Banking 🔒'] },
      kpis: { totalCases: 10, upheldRate: 0.5, notUpheldRate: 0.5 },
      generatedAt: new Date().toISOString(),
    },
    headers: { 'x-forwarded-for': `e2e-export-sanitize-${Date.now()}` },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
});

test('public export applies a fixed-window request limit', async ({ request }) => {
  const clientId = `e2e-export-${Date.now()}`;
  const payload = {
    title: 'Rate limit report',
    filters: {},
    kpis: { totalCases: 10, upheldRate: 0.5, notUpheldRate: 0.5 },
    generatedAt: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await request.post('/api/fos/export', {
      data: payload,
      headers: { 'x-forwarded-for': clientId },
    });
    expect(response.status()).toBe(200);
  }

  const limited = await request.post('/api/fos/export', {
    data: payload,
    headers: { 'x-forwarded-for': clientId },
  });
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0);
});
