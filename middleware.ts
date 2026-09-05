import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'ua-agency-dev-fallback-secret-please-set-AUTH_SECRET',
);
const SESSION_COOKIE = 'ua_session';

// Routes reachable without a session. The lead-gen cron endpoint guards itself
// with CRON_SECRET (Bearer), so it must bypass the cookie-session check.
const PUBLIC = ['/login', '/forgot-password', '/reset-password', '/api/leads/cron'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public marketing pages: the root landing plus two design variations. The
  // root page redirects signed-in visitors to /dashboard; the variations render
  // for everyone so they can be compared side by side. Exact match only.
  if (pathname === '/' || pathname === '/home2' || pathname === '/home3') {
    return NextResponse.next();
  }

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      // Members created with a temporary password must set their own before
      // they can use anything else — pin them to /change-password until they do.
      const mustChange = !!(payload as { mcp?: boolean }).mcp;
      const onChangePage =
        pathname === '/change-password' || pathname.startsWith('/change-password/');
      if (mustChange && !onChangePage && !pathname.startsWith('/api/')) {
        const url = req.nextUrl.clone();
        url.pathname = '/change-password';
        url.search = '';
        return NextResponse.redirect(url);
      }
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
