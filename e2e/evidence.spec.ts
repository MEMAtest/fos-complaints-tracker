import { test, expect, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('evidence workflow supports preview, duplicate warning, archive, and delete', async ({ page }) => {
  test.setTimeout(120_000);

  const complaintReference = `E2E-EVIDENCE-${Date.now()}`;
  let complaintId: string | null = null;

  try {
    await signIn(page, 'operator@local.test', 'OperatorPass123!');
    complaintId = await createComplaint(page, {
      complaintReference,
      complainantName: 'Evidence Flow Tester',
      firmName: 'MEMA Test Firm',
      receivedDate: '2026-03-21',
      complaintType: 'service',
      complaintCategory: 'service issue',
      description: 'Evidence workflow validation.',
      product: 'Banking and credit',
      status: 'open',
      priority: 'medium',
    });

    await page.goto(`/complaints/${complaintId}`);
    await page.getByRole('button', { name: /^evidence$/i }).click();
    await page.setInputFiles('[data-testid="evidence-file-input"]', {
      name: 'complaint-email.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Customer email evidence.\nTimeline confirms delayed response.\nReference: EV-001\n', 'utf8'),
    });
    await page.getByLabel(/Category/i).selectOption('email');
    await page.getByTestId('evidence-summary-input').fill('Customer escalation email showing missed timeline.');
    await page.getByTestId('evidence-upload-button').click();

    await expect.poll(() => getEvidenceCount(page, complaintId)).toBe(1);
    const evidenceId = await getLatestEvidenceId(page, complaintId);
    await expect(page.getByTestId('evidence-preview-category')).toContainText('email');
    await expect(page.getByTestId('evidence-text-preview')).toContainText('Timeline confirms delayed response.');

    await page.setInputFiles('[data-testid="evidence-file-input"]', {
      name: 'complaint-email-copy.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Customer email evidence.\nTimeline confirms delayed response.\nReference: EV-001\n', 'utf8'),
    });
    await page.getByTestId('evidence-upload-button').click();
    await expect(page.getByText(/Duplicate evidence detected/i)).toBeVisible();

    await page.getByRole('button', { name: /edit/i }).click();
    await page.getByTestId('evidence-edit-file-name').fill('complaint-email-renamed.txt');
    await page.getByTestId('evidence-edit-category').selectOption('letter');
    await page.getByTestId('evidence-edit-summary').fill('Renamed after evidence review.');
    await page.getByTestId('evidence-save-button').click();
    await expect(page.getByText('complaint-email-renamed.txt').first()).toBeVisible();
    await expect(page.getByTestId('evidence-preview-category')).toContainText('letter');

    await page.getByRole('button', { name: /edit/i }).click();
    await page.getByTestId('evidence-archive-button').click();
    await expect.poll(() => getEvidenceArchivedState(page, complaintId!, evidenceId)).toBe(true);

    await signOut(page);
    await signIn(page, 'manager@local.test', 'ManagerPass123!');
    await page.goto(`/complaints/${complaintId}`);
    await page.getByRole('button', { name: /^evidence$/i }).click();
    await page.getByRole('button', { name: /active only/i }).click();
    await page.getByText('complaint-email-renamed.txt').first().click();
    await page.getByRole('button', { name: /edit/i }).click();
    await page.getByTestId('evidence-delete-button').click();
    await expect.poll(() => getEvidencePresence(page, complaintId!, evidenceId)).toBe(false);
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

async function getLatestEvidenceId(page: Page, complaintId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/complaints/${id}/evidence?includeArchived=1`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success || !Array.isArray(body.evidence) || body.evidence.length === 0) {
      throw new Error(body.error || 'Failed to load evidence list.');
    }
    return body.evidence[0].id as string;
  }, complaintId);
}

async function getEvidenceCount(page: Page, complaintId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/complaints/${id}/evidence?includeArchived=1`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success || !Array.isArray(body.evidence)) {
      return -1;
    }
    return body.evidence.length as number;
  }, complaintId);
}

async function getEvidenceArchivedState(page: Page, complaintId: string, evidenceId: string) {
  return page.evaluate(async ({ complaintId: id, evidenceId: currentEvidenceId }) => {
    const response = await fetch(`/api/complaints/${id}/evidence?includeArchived=1`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Failed to load evidence list.');
    }
    const evidence = Array.isArray(body.evidence)
      ? body.evidence.find((item: { id: string }) => item.id === currentEvidenceId)
      : null;
    return Boolean(evidence?.archivedAt);
  }, { complaintId, evidenceId });
}

async function getEvidencePresence(page: Page, complaintId: string, evidenceId: string) {
  return page.evaluate(async ({ complaintId: id, evidenceId: currentEvidenceId }) => {
    const response = await fetch(`/api/complaints/${id}/evidence?includeArchived=1`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Failed to load evidence list.');
    }
    return Array.isArray(body.evidence)
      ? body.evidence.some((item: { id: string }) => item.id === currentEvidenceId)
      : false;
  }, { complaintId, evidenceId });
}
