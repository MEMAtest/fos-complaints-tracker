import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';

const PROTECTED_PAGE_PREFIXES = ['/complaints', '/imports/complaints', '/board-pack'];
const PROTECTED_API_PREFIXES = ['/api/complaints', '/api/fos/board-pack'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (pathname === '/login') {
    return NextResponse.next();
  }

  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isProtectedPage && !hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const isProtectedApi = PROTECTED_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isProtectedApi && !hasSessionCookie) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/complaints/:path*', '/imports/complaints/:path*', '/board-pack/:path*', '/api/complaints/:path*', '/api/fos/board-pack/:path*', '/login'],
};
