import { NextRequest } from 'next/server';
import { getComplaintWorkspaceSettings, updateComplaintWorkspaceSettings } from '@/lib/complaints/repository';
import type { ComplaintWorkspaceSettingsInput } from '@/lib/complaints/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const settings = await getComplaintWorkspaceSettings();
    return Response.json({ success: true, settings });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch complaints settings.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const settings = await updateComplaintWorkspaceSettings(body as ComplaintWorkspaceSettingsInput);
    return Response.json({ success: true, settings });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update complaints settings.' }, { status: 500 });
  }
}
