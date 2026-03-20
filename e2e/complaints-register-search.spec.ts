import { test, expect, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('complaints register searches correspondence and exports filtered CSV', async ({ page }) => {
  test.setTimeout(120_000);

  const complaintReference = `E2E-REGISTER-${Date.now()}`;
  const searchToken = `letter-token-${Date.now()}`;
  let complaintId: string | null = null;
  let exportHref = '';

  try {
    await signIn(page, 'operator@local.test', 'OperatorPass123!');
    complaintId = await createComplaint(page, {
      complaintReference,
      complainantName: 'Register Search Tester',
      firmName: 'MEMA Test Firm',
      receivedDate: '2026-03-01',
      complaintType: 'service',
      complaintCategory: 'service issue',
      description: 'Register search validation complaint.',
      product: 'Banking and credit',
      status: 'open',
      priority: 'high',
      notes: 'Operator note for complaints register search coverage.',
    });
    const letterId = await createLetter(page, complaintId, {
      templateKey: 'custom',
      subject: 'Register search letter',
      bodyText: `${searchToken} appears only in the complaint letter body.`,
      recipientName: 'Register Search Tester',
    });
    await uploadEvidence(page, complaintId, `Evidence for ${searchToken}`);
    await updateLetterStatus(page, letterId, 'under_review');

    await signOut(page);
    await signIn(page, 'reviewer@local.test', 'ReviewerPass123!');
    await approveLetter(page, letterId);

    await page.goto('/complaints');
    await page.getByTestId('complaints-query').fill(searchToken);
    await page.getByTestId('complaints-letter-status').selectOption('approved');
    await page.getByTestId('complaints-has-evidence').selectOption('yes');
    await page.getByPlaceholder('Filter by reviewer').fill('Workspace Reviewer');

    const row = page.getByRole('row').filter({ hasText: complaintReference });
    await expect(row).toBeVisible();
    await expect(row).toContainText('approved');
    await expect(row).toContainText('Workspace Reviewer');

    exportHref = await page.getByTestId('complaints-export').getAttribute('href') || '';
    expect(exportHref).toContain('query=');
    expect(exportHref).toContain('letterStatus=approved');
    expect(exportHref).toContain('hasEvidence=yes');

    const csv = await page.evaluate(async (href) => {
      const response = await fetch(href, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to export complaints CSV.');
      }
      return response.text();
    }, exportHref);

    expect(csv).toContain('Complaint reference');
    expect(csv).toContain(complaintReference);
    expect(csv).toContain('approved');
    expect(csv).toContain('Workspace Reviewer');
  } finally {
    await signOut(page).catch(() => undefined);
    await signIn(page, 'manager@local.test', 'ManagerPass123!').catch(() => undefined);
    if (complaintId) {
      await page.evaluate(async (id) => {
        await fetch(`/api/complaints/${id}`, { method: 'DELETE' });
      }, complaintId).catch(() => undefined);
    }
  }
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.evaluate(async ({ email, password }) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'same-origin',
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Login failed.');
    }
  }, { email, password });
  await expect.poll(async () => {
    return page.evaluate(async () => {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      return response.status;
    });
  }).toBe(200);
}

async function signOut(page: Page) {
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  });
}

async function createComplaint(page: Page, payload: Record<string, unknown>) {
  return page.evaluate(async (body) => {
    const response = await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Failed to create complaint.');
    }
    return json.complaint.id as string;
  }, payload);
}

async function createLetter(page: Page, complaintId: string, payload: Record<string, unknown>) {
  return page.evaluate(async ({ complaintId: id, payload: body }) => {
    const response = await fetch(`/api/complaints/${id}/letters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Failed to create letter.');
    }
    return json.letter.id as string;
  }, { complaintId, payload });
}

async function updateLetterStatus(page: Page, letterId: string, status: string) {
  await page.evaluate(async ({ letterId: id, status }) => {
    const response = await fetch(`/api/complaints/letters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Failed to update letter status.');
    }
  }, { letterId, status });
}

async function approveLetter(page: Page, letterId: string) {
  await page.evaluate(async (id) => {
    const response = await fetch(`/api/complaints/letters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'approved',
        reviewDecisionCode: 'ready_to_issue',
        reviewDecisionNote: 'Approved for Phase 7 register search smoke.',
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Failed to approve letter.');
    }
  }, letterId);
}

async function uploadEvidence(page: Page, complaintId: string, text: string) {
  await page.evaluate(async ({ complaintId: id, text }) => {
    const file = new File([text], 'register-evidence.txt', { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'other');
    formData.append('summary', text);
    const response = await fetch(`/api/complaints/${id}/evidence`, {
      method: 'POST',
      body: formData,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Failed to upload evidence.');
    }
  }, { complaintId, text });
}
