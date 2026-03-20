import { NextRequest } from 'next/server';
import { buildSessionCookieHeader, loginWithPassword } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const email = String((body as { email?: string }).email || '').trim();
    const password = String((body as { password?: string }).password || '');
    if (!email || !password) {
      return Response.json({ success: false, error: 'Email and password are required.' }, { status: 400 });
    }

    const { sessionToken, session } = await loginWithPassword(request, email, password);
    return new Response(JSON.stringify({ success: true, user: session.user }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildSessionCookieHeader(sessionToken, session.expiresAt),
      },
    });
  } catch (error) {
    const status = error instanceof Error && 'status' in error && typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to sign in.' }, { status });
  }
}
