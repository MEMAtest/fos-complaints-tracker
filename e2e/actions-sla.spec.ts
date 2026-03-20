import { test, expect, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('complaint actions panel surfaces system SLA actions and supports manual action completion', async ({ page }) => {
  test.setTimeout(120_000);

  const complaintReference = `E2E-ACTIONS-${Date.now()}`;
  const receivedDate = daysAgo(70);
  const manualDueDate = daysFromNow(3);
  let complaintId: string | null = null;

  try {
    await signIn(page, 'operator@local.test', 'OperatorPass123!');
    complaintId = await createComplaint(page, {
      complaintReference,
      complainantName: 'Actions and SLA Tester',
      firmName: 'MEMA Test Firm',
      receivedDate,
      complaintType: 'service',
      complaintCategory: 'service issue',
      description: 'Complaint actions and SLA automation smoke test.',
      product: 'Banking and credit',
      status: 'open',
      priority: 'high',
    });

    await page.goto(`/complaints/${complaintId}`);
    await expect(page.getByTestId('sla-state')).toContainText(/overdue/i);
    await expect(page.getByText('Issue 4-week progress update')).toBeVisible();
    await expect(page.getByText('Issue 8-week final response')).toBeVisible();

    await page.getByTestId('action-title-input').fill('Call complainant with remediation update');
    await page.getByTestId('action-due-date-input').fill(manualDueDate);
    await page.getByTestId('action-create-button').click();

    const manualCard = page.getByTestId('action-card').filter({ hasText: 'Call complainant with remediation update' });
    await expect(manualCard).toBeVisible();
    await manualCard.getByRole('button', { name: /complete/i }).click();
    await expect(manualCard).toContainText(/completed/i);
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

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
