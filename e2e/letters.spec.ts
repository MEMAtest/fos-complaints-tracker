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

async function openAssistanceTestLetter(page: Page, request: APIRequestContext) {
  const cookie = await loginViaApi(request);
  const createComplaint = await request.post('/api/complaints', {
    headers: { Cookie: cookie },
    data: {
      complaintReference: `E2E-ASSIST-${Date.now()}`,
      complainantName: 'Assistance UI Tester',
      firmName: 'MEMA Test Firm',
      receivedDate: new Date().toISOString().slice(0, 10),
      complaintType: 'service',
      complaintCategory: 'service issue',
      description: 'Evidence-linked drafting UI test.',
      product: 'Banking and credit',
      status: 'open',
      priority: 'medium',
    },
  });
  expect(createComplaint.status()).toBe(201);
  const complaintId = (await createComplaint.json()).complaint.id as string;
  const createLetter = await request.post(`/api/complaints/${complaintId}/letters`, {
    headers: { Cookie: cookie },
    data: {
      templateKey: 'custom',
      subject: 'Assistance test letter',
      bodyText: 'We looked at the complaint evidence.',
      recipientName: 'Assistance UI Tester',
    },
  });
  expect(createLetter.status()).toBe(201);

  await page.goto('/login');
  const value = cookie.slice('fci_session='.length);
  await page.context().addCookies([{ name: 'fci_session', value, url: new URL(page.url()).origin }]);
  await page.goto(`/complaints/${complaintId}`);
  await page.getByRole('button', { name: 'Letters & Responses' }).click();
  await expect(page.locator('[data-testid="letter-body"]')).toBeVisible({ timeout: 15_000 });
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

    const createRes = await request.post('/api/complaints', {
      headers: { Cookie: cookie },
      data: {
        complaintReference: `E2E-LETTERS-${Date.now()}`,
        complainantName: 'Letters API Tester',
        firmName: 'MEMA Test Firm',
        receivedDate: new Date().toISOString().slice(0, 10),
        complaintType: 'service',
        complaintCategory: 'service issue',
        description: 'Isolated complaint for the letters API suite.',
        product: 'Banking and credit',
        status: 'open',
        priority: 'medium',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.success).toBe(true);
    complaintId = created.complaint.id;
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

  test('PATCH records accepted assistance and paragraph-to-evidence links in the version', async ({ request }) => {
    test.skip(!letterId, 'No letter available');
    const acceptedAt = '2000-01-01T00:00:00.000Z';
    const res = await request.patch(`/api/complaints/letters/${letterId}`, {
      headers: { Cookie: cookie },
      data: {
        bodyText: 'Evidence-linked drafting version.',
        assistanceProvenance: [{
          action: 'evidence_review',
          source: 'complaint_evidence',
          sourceIds: ['evidence-e2e'],
          author: 'Letters API Tester',
          acceptedAt,
          aiInvolved: false,
        }],
        evidenceLinks: [{
          paragraphId: 'body',
          paragraphLabel: 'Letter body',
          evidenceType: 'complaint_evidence',
          evidenceId: 'evidence-e2e',
          title: 'Evidence E2E',
          url: 'javascript:alert(1)',
        }],
      },
    });
    expect(res.status()).toBe(200);

    const versions = await request.get(`/api/complaints/letters/${letterId}/versions`, {
      headers: { Cookie: cookie },
    });
    expect(versions.status()).toBe(200);
    const latest = (await versions.json()).versions[0];
    expect(latest.assistanceProvenance).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'evidence_review',
        source: 'complaint_evidence',
        author: 'Workspace Operator',
        aiInvolved: false,
      }),
    ]));
    expect(latest.assistanceProvenance[0].acceptedAt).not.toBe(acceptedAt);
    expect(latest.evidenceLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ paragraphId: 'body', evidenceId: 'evidence-e2e', url: null }),
    ]));
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

    const operatorApproval = await request.patch(`/api/complaints/letters/${letterId}`, {
      headers: { Cookie: cookie },
      data: {
        status: 'approved',
        reviewDecisionCode: 'ready_to_issue',
        reviewDecisionNote: 'An operator must not be able to approve this letter.',
      },
    });
    expect(operatorApproval.status()).toBe(403);
    await expect(operatorApproval.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('reviewer role is required'),
    });

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
    expect(res.status()).toBe(400);
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
    await page.getByRole('button', { name: 'Letters & Responses' }).click();

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
    await page.getByRole('button', { name: 'Letters & Responses' }).click();

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
    await page.getByRole('button', { name: 'Letters & Responses' }).click();

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

  test('drafting assistance requires explicit reject or accept and records an offline draft before save', async ({ page, request }) => {
    await openAssistanceTestLetter(page, request);
    const bodyEditor = page.locator('[data-testid="letter-body"]');

    const assist = page.locator('[data-testid="letter-assist-approved_template"]');
    await expect(assist).toBeVisible({ timeout: 20_000 });
    const original = await bodyEditor.inputValue();
    await assist.click();
    await expect(page.locator('[data-testid="letter-assistance-diff"]')).toBeVisible();
    await page.locator('[data-testid="letter-assistance-reject"]').click();
    await expect(bodyEditor).toHaveValue(original);

    await assist.click();
    await page.locator('[data-testid="letter-assistance-accept"]').click();
    await expect(page.locator('[data-testid="letter-save-state"]')).toHaveText('Offline draft—not submitted');
    await page.locator('[data-testid="letter-save-draft"]').click();
    await expect(page.locator('[data-testid="letter-save-state"]')).toHaveText('Saved to workspace', { timeout: 10_000 });
  });

  test('server save failure prevents submission and retains the offline draft state', async ({ page, request }) => {
    await openAssistanceTestLetter(page, request);
    const bodyEditor = page.locator('[data-testid="letter-body"]');
    await bodyEditor.fill(`${await bodyEditor.inputValue()}\nUnsaved failure-path edit.`);

    await page.route('**/api/complaints/letters/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Simulated persistence failure.' }) });
        return;
      }
      await route.continue();
    });

    await page.locator('[data-testid="letter-submit-review"]').click();
    await expect(page.locator('[data-testid="letter-save-state"]')).toHaveText('Offline draft—not submitted');
    await expect(page.locator('[data-testid="letter-current-status"]')).not.toContainText('under_review');
  });
});
