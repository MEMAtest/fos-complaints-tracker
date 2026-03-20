import { test, expect, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('letter review workflow supports submit, reject, diff, and approve', async ({ page }) => {
  test.setTimeout(120_000);
  const complaintReference = `E2E-LETTER-${Date.now()}`;

  await signIn(page, 'operator@local.test', 'OperatorPass123!');

  const complaintId = await page.evaluate(async (payload) => {
    const response = await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || 'Failed to create complaint.');
    }
    return body.complaint.id as string;
  }, {
    complaintReference,
    complainantName: 'Letter Review Tester',
    firmName: 'MEMA Test Firm',
    receivedDate: '2026-03-20',
    complaintType: 'service',
    complaintCategory: 'service issue',
    description: 'Letter review E2E workflow.',
    product: 'Banking and credit',
    status: 'open',
    priority: 'medium',
  });

  try {
    const letterId = await createLetter(page, complaintId, { templateKey: 'final_response' });
    await updateLetter(page, letterId, { status: 'under_review' });
    await expect.poll(() => getLatestLetterStatus(page, complaintId, letterId)).toBe('under_review');

    await page.goto(`/complaints/${complaintId}`);
    await page.getByRole('button', { name: /letters & responses/i }).click();
    await expect(page.getByTestId('letter-current-status')).toContainText('under_review');

    await signOut(page);
    await signIn(page, 'reviewer@local.test', 'ReviewerPass123!');
    await updateLetter(page, letterId, {
      status: 'rejected_for_rework',
      reviewDecisionCode: 'evidence_gap',
      reviewDecisionNote: 'Need clearer evidence references before signoff.',
      approvalNote: 'Need clearer evidence references before signoff.',
    });
    await expect.poll(() => getLatestLetterStatus(page, complaintId, letterId)).toBe('rejected_for_rework');

    await page.goto(`/complaints/${complaintId}`);
    await page.getByRole('button', { name: /letters & responses/i }).click();
    await expect(page.getByTestId('letter-current-status')).toContainText('rejected_for_rework');
    await expect(page.getByText('Need clearer evidence references before signoff.')).toBeVisible();

    await signOut(page);
    await signIn(page, 'operator@local.test', 'OperatorPass123!');
    await updateLetter(page, letterId, {
      bodyText: 'Updated body after rejection.\n\nAdded evidence references.',
      status: 'draft',
    });
    await updateLetter(page, letterId, { status: 'under_review' });

    await signOut(page);
    await signIn(page, 'reviewer@local.test', 'ReviewerPass123!');
    await page.goto(`/complaints/${complaintId}`);
    await page.getByRole('button', { name: /letters & responses/i }).click();
    await expect(page.getByTestId('letter-diff')).toContainText('Added evidence references.');
    await updateLetter(page, letterId, {
      status: 'approved',
      reviewDecisionCode: 'ready_to_issue',
      reviewDecisionNote: 'Review complete, ready to issue.',
      approvalNote: 'Review complete, ready to issue.',
    });
    await expect.poll(() => getLatestLetterStatus(page, complaintId, letterId)).toBe('approved');

    await page.reload();
    await page.getByRole('button', { name: /letters & responses/i }).click();
    await expect(page.getByTestId('letter-current-status')).toContainText('approved');
    await expect(page.getByText('Review complete, ready to issue.')).toBeVisible();
  } finally {
    await signOut(page).catch(() => undefined);
    await signIn(page, 'manager@local.test', 'ManagerPass123!').catch(() => undefined);
    await page.evaluate(async (id) => {
      await fetch(`/api/complaints/${id}`, { method: 'DELETE' });
    }, complaintId).catch(() => undefined);
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

async function getLatestLetterId(page: Page, complaintId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/complaints/${id}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Failed to load complaint detail.');
    }
    const letters = Array.isArray(body.complaint?.letters) ? body.complaint.letters : [];
    if (letters.length === 0) {
      throw new Error('No letters found.');
    }
    return letters[0].id as string;
  }, complaintId);
}

async function getLatestLetterStatus(page: Page, complaintId: string, letterId: string) {
  return page.evaluate(async ({ complaintId: id, letterId: currentLetterId }) => {
    const response = await fetch(`/api/complaints/${id}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Failed to load complaint detail.');
    }
    const letters = Array.isArray(body.complaint?.letters) ? body.complaint.letters : [];
    const letter = letters.find((item: { id: string }) => item.id === currentLetterId);
    if (!letter) {
      throw new Error('Letter not found.');
    }
    return letter.status as string;
  }, { complaintId, letterId });
}

async function createLetter(page: Page, complaintId: string, payload: Record<string, unknown>) {
  return page.evaluate(async ({ complaintId: id, payload: body }) => {
    const response = await fetch(`/api/complaints/${id}/letters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Failed to create letter.');
    }
    return json.letter.id as string;
  }, { complaintId, payload });
}

async function updateLetter(page: Page, letterId: string, payload: Record<string, unknown>) {
  return page.evaluate(async ({ letterId: id, payload: body }) => {
    const response = await fetch(`/api/complaints/letters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Failed to update letter.');
    }
    return json.letter;
  }, { letterId, payload });
}
