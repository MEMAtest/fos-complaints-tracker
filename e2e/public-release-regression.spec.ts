import { expect, test } from '@playwright/test';

const FIXTURE_PRODUCT = 'Banking and Payments';
const FIXTURE_FIRM = 'Barclays Bank UK PLC';
const FIXTURE_ROOT_CAUSE = 'Delay in claim handling';

test('public analytics surfaces agree on the fixture-backed product and firm slice', async ({ request }) => {
  const params = new URLSearchParams({
    product: FIXTURE_PRODUCT,
    firm: FIXTURE_FIRM,
  });

  const [dashboardResponse, analysisResponse] = await Promise.all([
    request.get(`/api/fos/dashboard?${params.toString()}&includeCases=false`),
    request.get(`/api/fos/analysis?${params.toString()}`),
  ]);

  expect(dashboardResponse.status()).toBe(200);
  expect(analysisResponse.status()).toBe(200);

  const dashboard = await dashboardResponse.json();
  const analysis = await analysisResponse.json();

  expect(dashboard.success).toBe(true);
  expect(dashboard.filters.products).toEqual([FIXTURE_PRODUCT]);
  expect(dashboard.filters.firms).toEqual([FIXTURE_FIRM]);
  expect(dashboard.data.overview).toMatchObject({
    totalCases: 600,
    upheldCases: 150,
    notUpheldCases: 300,
    partiallyUpheldCases: 150,
    upheldRate: 25,
    notUpheldRate: 50,
  });
  expect(dashboard.data.cases).toEqual([]);

  expect(analysis.success).toBe(true);
  expect(analysis.filters.products).toEqual([FIXTURE_PRODUCT]);
  expect(analysis.filters.firms).toEqual([FIXTURE_FIRM]);
  expect(analysis.data.yearProductOutcome).toEqual([
    {
      year: 2025,
      product: FIXTURE_PRODUCT,
      total: 600,
      upheld: 150,
      notUpheld: 300,
      partiallyUpheld: 150,
      upheldRate: 25,
      notUpheldRate: 50,
    },
  ]);
  expect(analysis.data.firmBenchmark).toEqual([
    expect.objectContaining({
      firm: FIXTURE_FIRM,
      total: 600,
      upheldRate: 25,
      notUpheldRate: 50,
      predominantProduct: FIXTURE_PRODUCT,
    }),
  ]);
});

test('public advisor returns the seeded root-cause brief without an AI dependency', async ({ request }) => {
  const params = new URLSearchParams({
    product: FIXTURE_PRODUCT,
    rootCause: FIXTURE_ROOT_CAUSE,
  });

  const response = await request.get(`/api/fos/advisor?${params.toString()}`);
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.data.query).toMatchObject({
    product: FIXTURE_PRODUCT,
    rootCause: FIXTURE_ROOT_CAUSE,
  });
  expect(body.data.riskAssessment).toMatchObject({
    totalCases: 600,
    sampleSize: 600,
    upheldRate: 25,
    notUpheldRate: 50,
    overallUpheldRate: 25,
    upholdRiskLevel: 'low',
    trendDirection: 'stable',
  });
  expect(body.data.recommendedActions).toContainEqual(
    expect.objectContaining({
      item: 'Issue progress updates before the four-week milestone',
      source: 'root_cause',
      priority: 'important',
    })
  );
});

test('check estimator carries its selected context into the full advisor brief', async ({ page }) => {
  await page.goto('/check');
  await expect(page.locator('#check-product')).not.toBeDisabled({ timeout: 15_000 });

  await page.locator('#check-product').selectOption(FIXTURE_PRODUCT);
  await page.locator('#check-root-cause').selectOption(FIXTURE_ROOT_CAUSE);
  await page.getByRole('button', { name: /Estimate likely uphold exposure/i }).click();

  await expect(page.getByText(/Estimated upheld rate/i).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: /Get the full Advisor Brief/i }).click();

  await expect(page).toHaveURL(
    new RegExp(
      `/advisor\\?product=${encodeURIComponent(FIXTURE_PRODUCT)}&rootCause=${encodeURIComponent(FIXTURE_ROOT_CAUSE)}`
    )
  );
  await expect(page.locator('#advisor-product')).not.toBeDisabled({ timeout: 15_000 });
  await expect(page.locator('#advisor-product')).toHaveValue(FIXTURE_PRODUCT);
  await expect(page.locator('#advisor-root-cause')).toHaveValue(FIXTURE_ROOT_CAUSE);
});

test('published year-product insight exposes exact fixture metrics and canonical schema', async ({ page }) => {
  const path = '/insights/year/2025/product/banking-and-payments';
  const canonicalUrl = `https://foscomplaints.memaconsultants.com${path}`;

  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Banking and Payments complaints in 2025' })
  ).toBeVisible();
  await expect(
    page.getByText(/600 published decisions in the corpus sit in Banking and Payments for 2025/)
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonicalUrl);

  const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents();
  const schemas = structuredData.map((value) => JSON.parse(value));
  expect(schemas).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        '@type': 'WebPage',
        name: 'Banking and Payments complaints in 2025',
        url: canonicalUrl,
      }),
      expect.objectContaining({
        '@type': 'FAQPage',
        mainEntity: expect.arrayContaining([
          expect.objectContaining({
            name: 'How many Banking and Payments ombudsman decisions were published in 2025?',
          }),
        ]),
      }),
    ])
  );
});
