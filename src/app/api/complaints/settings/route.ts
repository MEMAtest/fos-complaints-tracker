import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getComplaintWorkspaceSettings, updateComplaintWorkspaceSettings } from '@/lib/complaints/repository';
import type { ComplaintWorkspaceSettingsInput } from '@/lib/complaints/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request, 'viewer');
    const settings = await getComplaintWorkspaceSettings();
    return Response.json({ success: true, settings });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch complaints settings.' }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request, 'admin');
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const settings = await updateComplaintWorkspaceSettings(body as ComplaintWorkspaceSettingsInput);
    return Response.json({ success: true, settings });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update complaints settings.' }, { status });
  }
}
