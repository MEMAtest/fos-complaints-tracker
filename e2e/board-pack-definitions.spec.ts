import { test, expect, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('board-pack builder supports template defaults and saved definition lifecycle', async ({ page }) => {
  test.setTimeout(120_000);

  const definitionName = `E2E Board Pack ${Date.now()}`;

  try {
    await signIn(page, 'manager@local.test', 'ManagerPass123!');
    await page.goto('/board-pack');

    await expect(page.getByRole('heading', { name: 'Board Pack Builder' })).toBeVisible();
    await expect(page.getByTestId('board-pack-template').locator('option')).toHaveCount(4);
    await page.getByTestId('board-pack-template').selectOption('risk_committee');
    await expect(page.locator('input[type="text"]').first()).toHaveValue('Risk Committee Complaints Pack');

    await page.getByTestId('board-pack-definition-name').fill(definitionName);

    const saveResponse = page.waitForResponse((response) => (
      response.url().includes('/api/fos/board-pack/definitions') &&
      response.request().method() === 'POST'
    ));
    await page.getByTestId('board-pack-save-definition').click();
    await saveResponse;

    const card = page.getByTestId('board-pack-definition-card').filter({ hasText: definitionName });
    await expect(card).toBeVisible();
    await expect(page.getByText('Open actions')).toBeVisible();
    await expect(page.getByText('Appendix actions')).toBeVisible();

    await card.getByRole('button', { name: /load/i }).click();
    await expect(page.getByTestId('board-pack-definition-name')).toHaveValue(definitionName);

    const deleteResponse = page.waitForResponse((response) => (
      response.url().includes('/api/fos/board-pack/definitions/') &&
      response.request().method() === 'DELETE'
    ));
    await card.getByRole('button', { name: /delete/i }).click();
    await deleteResponse;
    await expect(card).toHaveCount(0);
  } finally {
    await cleanupDefinition(page, definitionName).catch(() => undefined);
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

async function cleanupDefinition(page: Page, name: string) {
  const definitions = await page.evaluate(async () => {
    const response = await fetch('/api/fos/board-pack/definitions', { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) {
      throw new Error(body.error || 'Failed to list board-pack definitions.');
    }
    return body.definitions as Array<{ id: string; name: string }>;
  });

  for (const definition of definitions.filter((entry) => entry.name === name)) {
    await page.evaluate(async (definitionId) => {
      await fetch(`/api/fos/board-pack/definitions/${definitionId}`, { method: 'DELETE' });
    }, definition.id);
  }
}
