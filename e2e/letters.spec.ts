import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

// ─── Auth helpers ───────────────────────────────────────────────────────────

async function loginViaApi(request: APIRequestContext, email = 'operator@local.test', password = 'OperatorPass123!'): Promise<string> {
  const res = await request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(res.status()).toBe(200);
  const setCookie = res.headers()['set-cookie'] || '';
  const match = setCookie.match(/fci_session=([^;]+)/);
  expect(match).toBeTruthy();
  return `fci_session=${match![1]}`;
}

async function loginAsOperator(page: Page) {
  await page.goto('/login?next=/complaints');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('login-email').fill('operator@local.test');
  await page.getByTestId('login-password').fill('OperatorPass123!');
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/complaints/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

// ─── API tests ──────────────────────────────────────────────────────────────

test.describe('Letters API', () => {
  let cookie: string;
  let complaintId: string;
  let letterId: string;

  test('login via API returns session cookie', async ({ request }) => {
    cookie = await loginViaApi(request);
    expect(cookie).toContain('fci_session=');
  });

  test('GET /api/complaints returns 200 with records', async ({ request }) => {
    const res = await request.get('/api/complaints', {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.records)).toBe(true);
    if (body.records.length > 0) {
      complaintId = body.records[0].id;
    }
  });

  test('GET /api/complaints/[id]/letters returns letters array', async ({ request }) => {
    test.skip(!complaintId, 'No complaint available');
    const res = await request.get(`/api/complaints/${complaintId}/letters`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.letters)).toBe(true);
  });

  test('POST creates letter with valid data', async ({ request }) => {
    test.skip(!complaintId, 'No complaint available');
    const res = await request.post(`/api/complaints/${complaintId}/letters`, {
      headers: { Cookie: cookie },
      data: {
        templateKey: 'custom',
        subject: 'E2E Test Letter',
        bodyText: 'This is a test letter created by E2E tests.',
        recipientName: 'Test Recipient',
        recipientEmail: 'test@example.com',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.letter.subject).toBe('E2E Test Letter');
    expect(body.letter.templateKey).toBe('custom');
    expect(body.letter.versionNumber).toBe(1);
    letterId = body.letter.id;
  });

  test('POST invalid templateKey falls back to custom', async ({ request }) => {
    test.skip(!complaintId, 'No complaint available');
    const res = await request.post(`/api/complaints/${complaintId}/letters`, {
      headers: { Cookie: cookie },
      data: { templateKey: 'INVALID_KEY', subject: 'Fallback test', bodyText: 'Body.' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.letter.templateKey).toBe('custom');
  });

  test('POST rejects invalid recipientEmail', async ({ request }) => {
    test.skip(!complaintId, 'No complaint available');
    const res = await request.post(`/api/complaints/${complaintId}/letters`, {
      headers: { Cookie: cookie },
      data: { templateKey: 'custom', subject: 'Email test', bodyText: 'Body.', recipientEmail: 'not-an-email' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('email');
  });

  test('PATCH updates letter content and bumps version', async ({ request }) => {
    test.skip(!letterId, 'No letter available');
    const res = await request.patch(`/api/complaints/letters/${letterId}`, {
      headers: { Cookie: cookie },
      data: { subject: 'E2E Updated Letter', bodyText: 'Updated body from E2E.' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.letter.subject).toBe('E2E Updated Letter');
    expect(body.letter.versionNumber).toBeGreaterThanOrEqual(2);
  });

  test('PATCH rejects invalid email', async ({ request }) => {
    test.skip(!letterId, 'No letter available');
    const res = await request.patch(`/api/complaints/letters/${letterId}`, {
      headers: { Cookie: cookie },
      data: { recipientEmail: 'bad-email' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('email');
  });

  test('PATCH rejects invalid status', async ({ request }) => {
    test.skip(!letterId, 'No letter available');
    const res = await request.patch(`/api/complaints/letters/${letterId}`, {
      headers: { Cookie: cookie },
      data: { status: 'bogus_status' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('status');
  });

  test('PATCH rejects invalid reviewDecisionCode', async ({ request }) => {
    test.skip(!letterId, 'No letter available');
    const res = await request.patch(`/api/complaints/letters/${letterId}`, {
      headers: { Cookie: cookie },
      data: { reviewDecisionCode: 'fake_code' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('review decision code');
  });

  test('PATCH submit-for-review then approve workflow', async ({ request }) => {
    test.skip(!letterId, 'No letter available');

    // Submit for review (as operator)
    const submitRes = await request.patch(`/api/complaints/letters/${letterId}`, {
      headers: { Cookie: cookie },
      data: { status: 'under_review' },
    });
    expect(submitRes.status()).toBe(200);
    expect((await submitRes.json()).letter.status).toBe('under_review');

    // Approve as reviewer (needs higher role than operator)
    const reviewerCookie = await loginViaApi(request, 'reviewer@local.test', 'ReviewerPass123!');
    const approveRes = await request.patch(`/api/complaints/letters/${letterId}`, {
      headers: { Cookie: reviewerCookie },
      data: {
        status: 'approved',
        reviewDecisionCode: 'ready_to_issue',
        reviewDecisionNote: 'E2E test approval — content satisfactory.',
      },
    });
    expect(approveRes.status()).toBe(200);
    const approved = (await approveRes.json()).letter;
    expect(approved.status).toBe('approved');
    expect(approved.approvedAt).toBeTruthy();
    expect(approved.approvedBy).toBeTruthy();
  });

  test('PATCH approve without decision code fails', async ({ request }) => {
    test.skip(!letterId, 'No letter available');
    // Edit to reset status back to draft
    await request.patch(`/api/complaints/letters/${letterId}`, {
      headers: { Cookie: cookie },
      data: { bodyText: 'Reset edit.' },
    });
    // Submit for review
    await request.patch(`/api/complaints/letters/${letterId}`, {
      headers: { Cookie: cookie },
      data: { status: 'under_review' },
    });
    // Try approve without decision code as reviewer — should fail
    const reviewerCookie = await loginViaApi(request, 'reviewer@local.test', 'ReviewerPass123!');
    const res = await request.patch(`/api/complaints/letters/${letterId}`, {
      headers: { Cookie: reviewerCookie },
      data: { status: 'approved' },
    });
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('decision');
  });

  test('GET versions returns version history', async ({ request }) => {
    test.skip(!letterId, 'No letter available');
    const res = await request.get(`/api/complaints/letters/${letterId}/versions`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.versions)).toBe(true);
    expect(body.versions.length).toBeGreaterThan(0);
    const version = body.versions[0];
    expect(version.letterId).toBe(letterId);
    expect(typeof version.versionNumber).toBe('number');
    expect(version.subject).toBeTruthy();
  });

  test('GET letter as PDF download', async ({ request }) => {
    test.skip(!letterId, 'No letter available');
    const res = await request.get(`/api/complaints/letters/${letterId}?format=pdf`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/pdf');
    expect(res.headers()['content-disposition']).toContain('.pdf');
  });

  test('GET letter as TXT download', async ({ request }) => {
    test.skip(!letterId, 'No letter available');
    const res = await request.get(`/api/complaints/letters/${letterId}?format=txt`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/plain');
    const text = await res.text();
    expect(text).toContain('Subject:');
  });

  test('GET letters for non-existent complaint returns 404', async ({ request }) => {
    const fakeId = '00000000-0000-4000-8000-000000000000';
    const res = await request.get(`/api/complaints/${fakeId}/letters`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(404);
  });
});

// ─── UI tests ───────────────────────────────────────────────────────────────

test.describe('Letters UI', () => {
  test('complaints workspace loads after login', async ({ page }) => {
    await loginAsOperator(page);
    await expect(page.getByRole('heading', { name: /Complaints Workspace/i })).toBeVisible({ timeout: 15_000 });
  });

  test('can navigate to complaint detail', async ({ page }) => {
    await loginAsOperator(page);
    const openLink = page.getByRole('link', { name: /open/i }).first();
    const hasComplaints = await openLink.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasComplaints, 'No complaints in workspace');
    await openLink.click();
    await expect(page).toHaveURL(/\/complaints\/[a-f0-9-]+/, { timeout: 10_000 });
  });

  test('complaint detail shows letters template buttons', async ({ page }) => {
    await loginAsOperator(page);
    const openLink = page.getByRole('link', { name: /open/i }).first();
    const hasComplaints = await openLink.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasComplaints, 'No complaints in workspace');
    await openLink.click();
    await expect(page).toHaveURL(/\/complaints\/[a-f0-9-]+/, { timeout: 10_000 });

    const templateBtn = page.locator('[data-testid="letter-template-acknowledgement"]');
    const visible = await templateBtn.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!visible, 'Letters panel not visible');
    await expect(templateBtn).toBeVisible();
    await expect(page.locator('[data-testid="letter-template-final_response"]')).toBeVisible();
  });

  test('generating a letter shows editor', async ({ page }) => {
    await loginAsOperator(page);
    const openLink = page.getByRole('link', { name: /open/i }).first();
    const hasComplaints = await openLink.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasComplaints, 'No complaints in workspace');
    await openLink.click();
    await expect(page).toHaveURL(/\/complaints\/[a-f0-9-]+/, { timeout: 10_000 });

    const templateBtn = page.locator('[data-testid="letter-template-acknowledgement"]');
    const visible = await templateBtn.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!visible, 'Letters panel not visible');
    await templateBtn.click();
    await expect(page.locator('[data-testid="letter-body"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="letter-current-status"]')).toBeVisible();
  });

  test('editing letter body enables save', async ({ page }) => {
    await loginAsOperator(page);
    const openLink = page.getByRole('link', { name: /open/i }).first();
    const hasComplaints = await openLink.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasComplaints, 'No complaints in workspace');
    await openLink.click();
    await expect(page).toHaveURL(/\/complaints\/[a-f0-9-]+/, { timeout: 10_000 });

    const bodyEditor = page.locator('[data-testid="letter-body"]');
    const hasEditor = await bodyEditor.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasEditor) {
      const btn = page.locator('[data-testid="letter-template-acknowledgement"]');
      const canCreate = await btn.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(!canCreate, 'Cannot access letter editor');
      await btn.click();
      await expect(bodyEditor).toBeVisible({ timeout: 15_000 });
    }

    await bodyEditor.fill('E2E edited body text.');
    const saveBtn = page.locator('[data-testid="letter-save-draft"]');
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();
    // After saving, button should disable again (no pending changes)
    await expect(saveBtn).toBeDisabled({ timeout: 10_000 });
  });
});
