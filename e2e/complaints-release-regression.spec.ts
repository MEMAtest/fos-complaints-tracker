import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';

const USERS = {
  viewer: ['viewer@local.test', 'ViewerPass123!'],
  operator: ['operator@local.test', 'OperatorPass123!'],
  manager: ['manager@local.test', 'ManagerPass123!'],
} as const;

test.describe('authenticated complaints release regressions', () => {
  test('CSV preview is non-mutating and commit creates the reviewed complaint', async ({ request }) => {
    const complaintReference = uniqueReference('IMPORT-NEW');
    let complaintId: string | null = null;

    try {
      await login(request, 'operator');
      const csv = complaintCsv({
        complaintReference,
        complainantName: 'Import Preview Owner',
        firmName: 'Release Regression Bank',
        status: 'investigating',
        priority: 'high',
        notes: 'Created only after an explicit import commit.',
      });

      const previewResponse = await uploadImport(request, csv, true, `${complaintReference}.csv`);
      expect(previewResponse.status()).toBe(200);
      const preview = await previewResponse.json();
      expect(preview).toMatchObject({
        success: true,
        preview: true,
        summary: {
          totalRows: 1,
          validRows: 1,
          newCount: 1,
          overwriteCount: 0,
          invalidCount: 0,
        },
      });
      expect(preview.rows[0]).toMatchObject({
        complaintReference,
        action: 'new',
        issues: [],
      });
      expect(await findComplaint(request, complaintReference)).toBeNull();

      const commitResponse = await uploadImport(request, csv, false, `${complaintReference}.csv`);
      expect(commitResponse.status()).toBe(200);
      await expect(commitResponse.json()).resolves.toMatchObject({
        success: true,
        preview: false,
        importedCount: 1,
        overwrittenCount: 0,
        skippedCount: 0,
      });

      const imported = await findComplaint(request, complaintReference);
      expect(imported).toMatchObject({
        complaintReference,
        complainantName: 'Import Preview Owner',
        firmName: 'Release Regression Bank',
        status: 'investigating',
        priority: 'high',
      });
      complaintId = imported!.id;
    } finally {
      await deleteOwnedComplaint(request, complaintId);
    }
  });

  test('CSV import identifies and commits an overwrite without creating a second complaint', async ({ request }) => {
    const complaintReference = uniqueReference('IMPORT-OVERWRITE');
    let complaintId: string | null = null;

    try {
      await login(request, 'operator');
      const created = await createComplaint(request, complaintReference, {
        complainantName: 'Original Import Owner',
        status: 'open',
        priority: 'low',
        notes: 'Original value before overwrite.',
      });
      complaintId = created.id;

      const csv = complaintCsv({
        complaintReference,
        complainantName: 'Updated Import Owner',
        firmName: 'Release Regression Bank',
        status: 'escalated',
        priority: 'urgent',
        notes: 'Updated by an explicitly reviewed overwrite.',
      });
      const previewResponse = await uploadImport(request, csv, true, `${complaintReference}.csv`);
      expect(previewResponse.status()).toBe(200);
      const preview = await previewResponse.json();
      expect(preview.summary).toMatchObject({
        totalRows: 1,
        validRows: 1,
        newCount: 0,
        overwriteCount: 1,
      });
      expect(preview.rows[0]).toMatchObject({ complaintReference, action: 'overwrite' });

      const commitResponse = await uploadImport(request, csv, false, `${complaintReference}.csv`);
      expect(commitResponse.status()).toBe(200);
      await expect(commitResponse.json()).resolves.toMatchObject({
        importedCount: 0,
        overwrittenCount: 1,
        skippedCount: 0,
      });

      const detailResponse = await request.get(`/api/complaints/${complaintId}`);
      expect(detailResponse.status()).toBe(200);
      const detail = await detailResponse.json();
      expect(detail.complaint).toMatchObject({
        id: complaintId,
        complaintReference,
        complainantName: 'Updated Import Owner',
        status: 'escalated',
        priority: 'urgent',
        notes: 'Updated by an explicitly reviewed overwrite.',
      });

      const matches = await findComplaints(request, complaintReference);
      expect(matches.filter((record) => record.complaintReference === complaintReference)).toHaveLength(1);
    } finally {
      await deleteOwnedComplaint(request, complaintId);
    }
  });

  test('viewer access is read-only while operator edits and manager deletion persist', async ({ request }) => {
    const complaintReference = uniqueReference('CRUD-ROLES');
    let complaintId: string | null = null;

    try {
      await login(request, 'operator');
      const created = await createComplaint(request, complaintReference, {
        complainantName: 'CRUD Role Owner',
        status: 'open',
        priority: 'medium',
      });
      complaintId = created.id;

      await login(request, 'viewer');
      expect((await request.get(`/api/complaints/${complaintId}`)).status()).toBe(200);
      expect((await request.patch(`/api/complaints/${complaintId}`, {
        data: { status: 'resolved' },
      })).status()).toBe(403);
      expect((await request.post(`/api/complaints/${complaintId}/actions`, {
        data: { title: 'Viewer must not create this action' },
      })).status()).toBe(403);
      expect((await request.delete(`/api/complaints/${complaintId}`)).status()).toBe(403);

      await login(request, 'operator');
      const updateResponse = await request.patch(`/api/complaints/${complaintId}`, {
        data: {
          status: 'resolved',
          priority: 'high',
          resolution: 'Resolved through release-regression validation.',
        },
      });
      expect(updateResponse.status()).toBe(200);
      const updated = await updateResponse.json();
      expect(updated.complaint).toMatchObject({
        id: complaintId,
        status: 'resolved',
        priority: 'high',
        resolution: 'Resolved through release-regression validation.',
      });
      expect((await request.delete(`/api/complaints/${complaintId}`)).status()).toBe(403);

      await login(request, 'manager');
      const deleteResponse = await request.delete(`/api/complaints/${complaintId}`);
      expect(deleteResponse.status()).toBe(200);
      await expect(deleteResponse.json()).resolves.toMatchObject({ success: true });
      expect((await request.get(`/api/complaints/${complaintId}`)).status()).toBe(404);
      complaintId = null;
    } finally {
      await deleteOwnedComplaint(request, complaintId);
    }
  });

  test('manager complaint deletion cascades to owned evidence, letter, and action records', async ({ request }) => {
    const complaintReference = uniqueReference('CASCADE');
    let complaintId: string | null = null;

    try {
      await login(request, 'operator');
      const created = await createComplaint(request, complaintReference, {
        complainantName: 'Cascade Resource Owner',
        status: 'open',
        priority: 'medium',
      });
      complaintId = created.id;

      const actionResponse = await request.post(`/api/complaints/${complaintId}/actions`, {
        data: {
          title: `Owned action ${complaintReference}`,
          description: 'Must be removed when its complaint is deleted.',
          status: 'open',
        },
      });
      expect(actionResponse.status()).toBe(201);
      const actionId = (await actionResponse.json()).action.id as string;

      const evidenceResponse = await request.post(`/api/complaints/${complaintId}/evidence`, {
        multipart: {
          file: {
            name: `${complaintReference}.txt`,
            mimeType: 'text/plain',
            buffer: Buffer.from(`Owned evidence for ${complaintReference}.`, 'utf8'),
          },
          category: 'email',
          summary: `Owned evidence ${complaintReference}`,
        },
      });
      expect(evidenceResponse.status()).toBe(201);
      const evidenceId = (await evidenceResponse.json()).evidence.id as string;

      const letterResponse = await request.post(`/api/complaints/${complaintId}/letters`, {
        data: {
          templateKey: 'custom',
          subject: `Owned letter ${complaintReference}`,
          bodyText: 'This release-regression letter belongs only to its complaint.',
          recipientName: 'Cascade Resource Owner',
        },
      });
      expect(letterResponse.status()).toBe(201);
      const letterId = (await letterResponse.json()).letter.id as string;

      expect((await request.delete(`/api/complaints/actions/${actionId}`)).status()).toBe(403);
      expect((await request.delete(`/api/complaints/evidence/${evidenceId}`)).status()).toBe(403);

      await login(request, 'manager');
      expect((await request.delete(`/api/complaints/${complaintId}`)).status()).toBe(200);
      complaintId = null;

      expect((await request.patch(`/api/complaints/actions/${actionId}`, {
        data: { status: 'completed' },
      })).status()).toBe(404);
      expect((await request.get(`/api/complaints/evidence/${evidenceId}?preview=1`)).status()).toBe(404);
      expect((await request.get(`/api/complaints/letters/${letterId}?format=txt`)).status()).toBe(404);
    } finally {
      await deleteOwnedComplaint(request, complaintId);
    }
  });
});

type UserRole = keyof typeof USERS;

type ComplaintRecord = {
  id: string;
  complaintReference: string;
  [key: string]: unknown;
};

async function login(request: APIRequestContext, role: UserRole): Promise<void> {
  const [email, password] = USERS[role];
  const response = await request.post('/api/auth/login', { data: { email, password } });
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ success: true, user: { email, role } });
}

async function createComplaint(
  request: APIRequestContext,
  complaintReference: string,
  overrides: Record<string, unknown> = {},
): Promise<ComplaintRecord> {
  const response = await request.post('/api/complaints', {
    data: {
      complaintReference,
      complainantName: `Owner ${complaintReference}`,
      firmName: 'Release Regression Bank',
      receivedDate: '2026-07-20',
      complaintType: 'service',
      complaintCategory: 'service issue',
      description: `Parallel-safe release regression complaint ${complaintReference}.`,
      product: 'Banking and credit',
      status: 'open',
      priority: 'medium',
      ...overrides,
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body).toMatchObject({ success: true, complaint: { complaintReference } });
  return body.complaint as ComplaintRecord;
}

async function findComplaint(request: APIRequestContext, complaintReference: string): Promise<ComplaintRecord | null> {
  const records = await findComplaints(request, complaintReference);
  return records.find((record) => record.complaintReference === complaintReference) || null;
}

async function findComplaints(request: APIRequestContext, complaintReference: string): Promise<ComplaintRecord[]> {
  const response = await request.get(`/api/complaints?query=${encodeURIComponent(complaintReference)}&limit=100`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(Array.isArray(body.records)).toBe(true);
  return body.records as ComplaintRecord[];
}

async function uploadImport(
  request: APIRequestContext,
  buffer: Buffer,
  preview: boolean,
  fileName: string,
) {
  return request.post('/api/complaints/import', {
    multipart: {
      file: { name: fileName, mimeType: 'text/csv', buffer },
      preview: String(preview),
    },
  });
}

async function deleteOwnedComplaint(request: APIRequestContext, complaintId: string | null): Promise<void> {
  if (!complaintId) return;
  await login(request, 'manager').catch(() => undefined);
  await request.delete(`/api/complaints/${complaintId}`).catch(() => undefined);
}

function complaintCsv(input: {
  complaintReference: string;
  complainantName: string;
  firmName: string;
  status: string;
  priority: string;
  notes: string;
}): Buffer {
  const headers = ['complaint_reference', 'complainant_name', 'received_date', 'firm_name', 'status', 'priority', 'notes'];
  const values = [
    input.complaintReference,
    input.complainantName,
    '2026-07-20',
    input.firmName,
    input.status,
    input.priority,
    input.notes,
  ];
  return Buffer.from(`${headers.join(',')}\n${values.map(csvCell).join(',')}\n`, 'utf8');
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function uniqueReference(prefix: string): string {
  return `E2E-RELEASE-${prefix}-${randomUUID()}`;
}
