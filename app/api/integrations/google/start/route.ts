import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { getSession } from '@/lib/auth';
import { isSuperStrict } from '@/lib/permissions';
import { hydrateSecrets } from '@/lib/secrets';
import { googleClientConfigured, buildAuthUrl, originFromRequest } from '@/lib/google';

export const dynamic = 'force-dynamic';

// Start the unified Google consent flow (Super Admin only).
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || !isSuperStrict(s.roles)) return NextResponse.redirect(new URL('/login', req.url));

  await hydrateSecrets();
  if (!googleClientConfigured()) return NextResponse.redirect(new URL('/settings?err=google_client', req.url));

  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(buildAuthUrl(originFromRequest(req), state));
  res.cookies.set('g_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
