import { NextRequest } from 'next/server';
import { clearSessionCookieHeader, logoutFromRequest } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await logoutFromRequest(request);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': clearSessionCookieHeader(),
      },
    });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to sign out.' }, { status: 500 });
  }
}
