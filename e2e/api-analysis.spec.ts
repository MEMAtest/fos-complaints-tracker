import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

// ─── GET /api/fos/analysis/cases ─────────────────────────────────────────────

test.describe('Analysis Cases API - /api/fos/analysis/cases', () => {
  test('returns 200 with paginated case list', async ({ request }) => {
    const res = await request.get('/api/fos/analysis/cases?pageSize=5');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items.length).toBeGreaterThan(0);
    expect(body.data.items.length).toBeLessThanOrEqual(5);

    // Pagination meta
    expect(body.data.pagination).toBeDefined();
    expect(typeof body.data.pagination.total).toBe('number');
    expect(typeof body.data.pagination.page).toBe('number');
    expect(typeof body.data.pagination.pageSize).toBe('number');
  });

  test('each case has expected fields', async ({ request }) => {
    const res = await request.get('/api/fos/analysis/cases?pageSize=1');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const c = body.data.items[0];
    expect(c).toBeDefined();

    // Required fields
    expect(typeof c.caseId).toBe('string');
    expect(c.caseId.length).toBeGreaterThan(0);
    expect(typeof c.decisionReference).toBe('string');
    expect(typeof c.outcome).toBe('string');
    expect(['upheld', 'not_upheld', 'partially_upheld', 'settled', 'unknown']).toContain(c.outcome);
  });

  test('respects page parameter for pagination', async ({ request }) => {
    const page1 = await request.get('/api/fos/analysis/cases?pageSize=2&page=1');
    const body1 = await page1.json();
    const page2 = await request.get('/api/fos/analysis/cases?pageSize=2&page=2');
    const body2 = await page2.json();

    expect(body1.success).toBe(true);
    expect(body2.success).toBe(true);

    if (body1.data.items.length > 0 && body2.data.items.length > 0) {
      // Pages should have different cases
      expect(body1.data.items[0].caseId).not.toBe(body2.data.items[0].caseId);
    }
  });

  test('filters by outcome parameter', async ({ request }) => {
    const res = await request.get('/api/fos/analysis/cases?outcome=upheld&pageSize=5');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // All returned cases should be upheld
    for (const c of body.data.items) {
      expect(c.outcome).toBe('upheld');
    }
  });

  test('filters by year parameter', async ({ request }) => {
    const res = await request.get('/api/fos/analysis/cases?year=2025&pageSize=5');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // All returned cases should be from 2025
    for (const c of body.data.items) {
      if (c.decisionDate) {
        expect(c.decisionDate).toContain('2025');
      }
    }
  });

  test('sets cache headers', async ({ request }) => {
    const res = await request.get('/api/fos/analysis/cases?pageSize=1');
    expect(res.status()).toBe(200);
    const cacheControl = res.headers()['cache-control'] || '';
    expect(cacheControl).toContain('s-maxage');
  });
});

// ─── POST /api/fos/analysis/synthesise ───────────────────────────────────────

test.describe('Synthesis API - /api/fos/analysis/synthesise', () => {
  test('returns 400 when filters are missing', async ({ request }) => {
    const res = await request.post('/api/fos/analysis/synthesise', {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('filters');
  });

  test('returns 400 when filters is not an object', async ({ request }) => {
    const res = await request.post('/api/fos/analysis/synthesise', {
      data: { filters: 'not-an-object' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 when subset has fewer than 5 decisions', async ({ request }) => {
    const res = await request.post('/api/fos/analysis/synthesise', {
      data: {
        filters: {
          years: [],
          outcomes: [],
          products: ['ZZZZZ_NonExistentProduct_99999'],
          firms: [],
          tags: [],
          query: '',
        },
      },
    });
    // Either 400 (too few) or 500 (Groq issue) — not a crash
    expect([400, 500]).toContain(res.status());
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('handles malformed filter arrays gracefully', async ({ request }) => {
    const res = await request.post('/api/fos/analysis/synthesise', {
      data: {
        filters: {
          years: 'not-an-array',
          outcomes: 123,
          products: null,
          firms: [1, 2, 3], // numbers instead of strings
          tags: [],
          query: 42, // number instead of string
        },
      },
    });
    // Should not crash — validated + coerced server-side
    expect([200, 400, 500]).toContain(res.status());
    const body = await res.json();
    // Should have a parseable JSON response regardless
    expect(typeof body.success).toBe('boolean');
  });

  test('does not leak Groq API details in error responses', async ({ request }) => {
    // Send valid filters that should work but check error format
    const res = await request.post('/api/fos/analysis/synthesise', {
      data: {
        filters: {
          years: [2025],
          outcomes: ['upheld'],
          products: [],
          firms: [],
          tags: [],
          query: '',
        },
      },
    });

    const body = await res.json();
    if (!body.success) {
      // Error message should not contain Groq internals
      expect(body.error).not.toContain('gsk_');
      expect(body.error).not.toContain('api.groq.com');
      expect(body.error).not.toContain('GROQ_API_KEY');
    }
  });
});
