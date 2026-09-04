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

  // The root URL is the marketing landing page. While the site is in private
  // preview it sits behind a simple password gate (HTTP Basic Auth). Signed-in
  // team members skip the gate — the page redirects them on to /dashboard.
  // Exact match only; every other route stays protected by the session check.
  if (pathname === '/') {
    const sess = req.cookies.get(SESSION_COOKIE)?.value;
    if (sess) {
      try {
        await jwtVerify(sess, SECRET);
        return NextResponse.next();
      } catch {
        // not a valid session → fall through to the preview gate
      }
    }
    const gate = process.env.LANDING_PASSWORD ?? 'keel-preview';
    if (gate) {
      const header = req.headers.get('authorization') ?? '';
      let ok = false;
      if (header.startsWith('Basic ')) {
        try {
          const decoded = atob(header.slice(6));
          ok = decoded.slice(decoded.indexOf(':') + 1) === gate;
        } catch {
          ok = false;
        }
      }
      if (!ok) {
        return new NextResponse('Private preview — password required.', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Keel Private Preview"' },
        });
      }
    }
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
