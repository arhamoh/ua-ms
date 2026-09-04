import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { isSuperStrict } from '@/lib/permissions';
import { hydrateSecrets, setSecret } from '@/lib/secrets';
import { exchangeCodeForTokens, fetchGoogleEmail } from '@/lib/google-oauth';

export const dynamic = 'force-dynamic';

const back = (req: NextRequest, params: string) => NextResponse.redirect(new URL(`/settings?${params}`, req.url));

// Google redirects here after consent. Exchange the code for a refresh token and
// store it (encrypted) so we can send mail as the connected account.
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || !isSuperStrict(s.roles)) return NextResponse.redirect(new URL('/login', req.url));

  await hydrateSecrets();
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get('g_oauth_state')?.value;

  if (url.searchParams.get('error')) return back(req, 'err=gmail_denied');
  if (!code || !state || !cookieState || state !== cookieState) return back(req, 'err=gmail_state');

  try {
    const { refreshToken, accessToken } = await exchangeCodeForTokens(code, url.origin);
    if (!refreshToken) return back(req, 'err=gmail_norefresh');
    const email = accessToken ? await fetchGoogleEmail(accessToken) : null;
    if (!email) return back(req, 'err=gmail_email');
    await setSecret('GMAIL_OAUTH_REFRESH_TOKEN', refreshToken);
    await setSecret('GMAIL_OAUTH_EMAIL', email);
    const res = back(req, 'done=gmail');
    res.cookies.delete('g_oauth_state');
    return res;
  } catch {
    return back(req, 'err=gmail_exchange');
  }
}
