import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'ua-agency-dev-fallback-secret-please-set-AUTH_SECRET',
);
const SESSION_COOKIE = 'ua_session';

// Routes reachable without a session. The lead-gen cron endpoint guards itself
// with CRON_SECRET (Bearer), so it must bypass the cookie-session check.
const PUBLIC = ['/login', '/forgot-password', '/api/leads/cron'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await jwtVerify(token, SECRET);
      return NextResponse.next();
    } catch {
      // fall through to redirect
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Protect everything except Next internals, the PWA files, and static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
};
