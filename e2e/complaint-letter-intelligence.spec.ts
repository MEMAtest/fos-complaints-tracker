import { test, expect, type APIRequestContext } from '@playwright/test';

async function loginViaApi(
  request: APIRequestContext,
  email = 'operator@local.test',
  password = 'OperatorPass123!'
): Promise<string> {
  const response = await request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const setCookie = response.headers()['set-cookie'] || '';
  const match = setCookie.match(/fci_session=([^;]+)/);
  expect(match).toBeTruthy();
  return `fci_session=${match![1]}`;
}

test('complaint letter intelligence exposes upholdRiskLevel, riskLevel alias, and sampleSize', async ({ request }) => {
  const operatorCookie = await loginViaApi(request);
  const managerCookie = await loginViaApi(request, 'manager@local.test', 'ManagerPass123!');
  const complaintReference = `E2E-INTEL-${Date.now()}`;

  const createResponse = await request.post('/api/complaints', {
    headers: { Cookie: operatorCookie },
    data: {
      complaintReference,
      complainantName: 'Intelligence API Tester',
      firmName: 'MEMA Test Firm',
      receivedDate: '2026-03-22',
      complaintType: 'service',
      complaintCategory: 'service issue',
      description: 'Complaint letter-intelligence API coverage.',
      product: 'Banking and credit',
      status: 'open',
      priority: 'medium',
    },
  });
  expect(createResponse.status()).toBe(201);
  const createBody = await createResponse.json();
  const complaintId = createBody.complaint.id as string;

  try {
    const response = await request.get(`/api/complaints/${complaintId}/letter-intelligence`, {
      headers: { Cookie: operatorCookie },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeTruthy();
    expect(typeof body.data.riskSnapshot.sampleSize).toBe('number');
    expect(body.data.riskSnapshot.sampleSize).toBeGreaterThan(0);
    expect(['low', 'medium', 'high', 'very_high']).toContain(body.data.riskSnapshot.upholdRiskLevel);
    expect(body.data.riskSnapshot.riskLevel).toBe(body.data.riskSnapshot.upholdRiskLevel);
  } finally {
    await request.delete(`/api/complaints/${complaintId}`, {
      headers: { Cookie: managerCookie },
    }).catch(() => undefined);
  }
});
