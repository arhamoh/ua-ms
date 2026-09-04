import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { isSuperStrict } from '@/lib/permissions';
import { hydrateSecrets, setSecret } from '@/lib/secrets';
import { exchangeCode, fetchUserEmail, resetGoogleTokenCache } from '@/lib/google';

export const dynamic = 'force-dynamic';

const back = (req: NextRequest, params: string) => NextResponse.redirect(new URL(`/settings?${params}`, req.url));

// Google redirects here after consent. Store the refresh token + connected email
// so Gmail, Calendar, Meet and Drive can all mint access tokens from it.
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || !isSuperStrict(s.roles)) return NextResponse.redirect(new URL('/login', req.url));

  await hydrateSecrets();
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get('g_oauth_state')?.value;

  if (url.searchParams.get('error')) return back(req, 'err=google_denied');
  if (!code || !state || !cookieState || state !== cookieState) return back(req, 'err=google_state');

  try {
    const { refreshToken, accessToken } = await exchangeCode(code, url.origin);
    if (!refreshToken) return back(req, 'err=google_norefresh');
    const email = accessToken ? await fetchUserEmail(accessToken) : null;
    if (!email) return back(req, 'err=google_email');
    await setSecret('GOOGLE_REFRESH_TOKEN', refreshToken);
    await setSecret('GOOGLE_CONNECTED_EMAIL', email);
    resetGoogleTokenCache();
    const res = back(req, 'done=google');
    res.cookies.delete('g_oauth_state');
    return res;
  } catch {
    return back(req, 'err=google_exchange');
  }
}
