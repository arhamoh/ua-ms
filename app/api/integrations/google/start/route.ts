import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { getSession } from '@/lib/auth';
import { isSuperStrict } from '@/lib/permissions';
import { hydrateSecrets } from '@/lib/secrets';
import { gmailClientConfigured, buildAuthUrl } from '@/lib/google-oauth';

export const dynamic = 'force-dynamic';

// Kick off the Gmail OAuth consent flow (Super Admin only).
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || !isSuperStrict(s.roles)) return NextResponse.redirect(new URL('/login', req.url));

  await hydrateSecrets();
  if (!gmailClientConfigured()) {
    return NextResponse.redirect(new URL('/settings?err=gmail_client', req.url));
  }

  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(buildAuthUrl(req.nextUrl.origin, state));
  // CSRF guard: match this against the `state` Google echoes back.
  res.cookies.set('g_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
