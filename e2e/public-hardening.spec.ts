import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function authenticatedCookie(request: import('@playwright/test').APIRequestContext) {
  const response = await request.post('/api/auth/login', {
    data: { email: 'viewer@local.test', password: 'ViewerPass123!' },
  });
  expect(response.status()).toBe(200);
  const match = (response.headers()['set-cookie'] || '').match(/fci_session=([^;]+)/);
  expect(match).toBeTruthy();
  return `fci_session=${match![1]}`;
}

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

test('authoritative export requires authentication and rejects excessive input', async ({ request }) => {
  const unauthenticated = await request.post('/api/fos/export', { data: { title: 'Private report', filters: {} } });
  expect(unauthenticated.status()).toBe(401);
  const cookie = await authenticatedCookie(request);

  const excessiveFilters = Object.fromEntries(
    Array.from({ length: 21 }, (_, index) => [`filter${index}`, `value${index}`])
  );
  const tooManyFilters = await request.post('/api/fos/export', {
    headers: { Cookie: cookie },
    data: {
      title: 'Oversized report',
      filters: excessiveFilters,
      kpis: { totalCases: 10, upheldRate: 0.5, notUpheldRate: 0.5 },
      generatedAt: new Date().toISOString(),
    },
  });
  expect(tooManyFilters.status()).toBe(400);
});

test('JSON endpoints reject bodies above 64 KB', async ({ request }) => {
  const oversized = 'x'.repeat(70 * 1024);
  const synthesis = await request.post('/api/fos/analysis/synthesise', {
    data: { filters: {}, padding: oversized },
  });
  expect(synthesis.status()).toBe(413);

  const exportResponse = await request.post('/api/fos/export', {
    headers: { Cookie: await authenticatedCookie(request) },
    data: {
      title: oversized,
      filters: {},
      kpis: { totalCases: 10, upheldRate: 0.5, notUpheldRate: 0.5 },
      generatedAt: new Date().toISOString(),
    },
  });
  expect(exportResponse.status()).toBe(413);
});

test('authoritative export ignores client KPIs and sanitises unsupported PDF characters', async ({ request }) => {
  const cookie = await authenticatedCookie(request);
  const response = await request.post('/api/fos/export', {
    data: {
      title: 'Report with emoji 🔒 and\nnew line',
      filters: { product: ['Banking 🔒'] },
      kpis: { totalCases: -999, upheldRate: 999, notUpheldRate: -999 },
      generatedAt: new Date().toISOString(),
    },
    headers: { Cookie: cookie, 'x-forwarded-for': `e2e-export-sanitize-${Date.now()}` },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
});

test('authoritative export applies a fixed-window request limit', async ({ request }) => {
  const clientId = `e2e-export-${Date.now()}`;
  const cookie = await authenticatedCookie(request);
  const payload = {
    title: 'Rate limit report',
    filters: {},
    kpis: { totalCases: 10, upheldRate: 0.5, notUpheldRate: 0.5 },
    generatedAt: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await request.post('/api/fos/export', {
      data: payload,
      headers: { Cookie: cookie, 'x-forwarded-for': clientId },
    });
    expect(response.status()).toBe(200);
  }

  const limited = await request.post('/api/fos/export', {
    data: payload,
    headers: { Cookie: cookie, 'x-forwarded-for': clientId },
  });
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0);
});
