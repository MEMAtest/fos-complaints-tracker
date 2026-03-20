import { NextRequest } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSessionFromRequest(request);
    if (!session) {
      return Response.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }
    return Response.json({ success: true, user: session.user, session: { expiresAt: session.expiresAt, lastSeenAt: session.lastSeenAt } }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to load session.' }, { status: 500 });
  }
}
