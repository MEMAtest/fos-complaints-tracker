import { test, expect, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('final-response template editor composes locked sections and outputs PDF', async ({ page }) => {
  test.setTimeout(120_000);

  const complaintReference = `E2E-TEMPLATE-${Date.now()}`;
  let complaintId: string | null = null;

  try {
    await signIn(page, 'operator@local.test', 'OperatorPass123!');
    complaintId = await createComplaint(page, {
      complaintReference,
      complainantName: 'Template Control Tester',
      firmName: 'MEMA Test Firm',
      receivedDate: '2026-03-22',
      complaintType: 'service',
      complaintCategory: 'service issue',
      description: 'Customer says we failed to explain the position clearly.',
      product: 'Banking and credit',
      status: 'open',
      priority: 'medium',
      resolution: 'Legacy resolution text should be replaced by structured editing.',
    });
    const letterId = await createLetter(page, complaintId, { templateKey: 'final_response' });

    await page.goto(`/complaints/${complaintId}`);
    await page.getByRole('button', { name: /letters & responses/i }).click();
    await expect(page.getByText('Template-controlled editor')).toBeVisible();
    await page.getByTestId('letter-decision-path').selectOption('partially_upheld');
    await page.getByTestId('letter-section-decision_reasons').fill('We identified a delay in our complaint handling and part of the communication fell below the standard expected.');
    await page.getByTestId('letter-section-redress').fill('We will apologise, correct the position, and pay GBP 150.00 for distress and inconvenience.');
    await expect(page.getByTestId('letter-composed-preview')).toContainText('After completing our review, we partially uphold your complaint.');
    await expect(page.getByTestId('letter-composed-preview')).toContainText('We identified a delay in our complaint handling and part of the communication fell below the standard expected.');
    const saveResponse = page.waitForResponse((response) => (
      response.url().includes(`/api/complaints/letters/${letterId}`) && response.request().method() === 'PATCH'
    ));
    await page.getByTestId('letter-save-draft').click();
    await saveResponse;
    await expect.poll(async () => {
      const text = await fetchLetterText(page, letterId);
      return text.includes('After completing our review, we partially uphold your complaint.');
    }).toBe(true);

    const letterText = await fetchLetterText(page, letterId);
    expect(letterText).toContain('After completing our review, we partially uphold your complaint.');
    expect(letterText).toContain('We identified a delay in our complaint handling');
    expect(letterText).toContain('The Financial Ombudsman Service is a free and independent service.');

    const pdfHeader = await fetchLetterPdfHeader(page, letterId);
    expect(pdfHeader).toBe('%PDF');
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

async function fetchLetterText(page: Page, letterId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/complaints/letters/${id}?format=txt`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch letter text.');
    }
    return response.text();
  }, letterId);
}

async function fetchLetterPdfHeader(page: Page, letterId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/complaints/letters/${id}?format=pdf`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch letter PDF.');
    }
    const buffer = await response.arrayBuffer();
    return String.fromCharCode(...new Uint8Array(buffer.slice(0, 4)));
  }, letterId);
}
