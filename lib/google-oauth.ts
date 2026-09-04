import 'server-only';

// Gmail "Sign in with Google" (OAuth 2.0) for sending email without an app
// password. For an internal Google Workspace app (consent screen = Internal),
// the mail scope needs no Google verification review.

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Full mail scope is required to send via SMTP XOAUTH2; `email` tells us which
// account was connected (used as the SMTP username / From address).
export const GMAIL_SCOPES = ['https://mail.google.com/', 'email'];

export function gmailClientConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function gmailConnected(): boolean {
  return Boolean(process.env.GMAIL_OAUTH_REFRESH_TOKEN && process.env.GMAIL_OAUTH_EMAIL);
}

/** The redirect URI Google calls back — must be registered verbatim in the
 *  Google Cloud OAuth client. Derived from the request origin. */
export function redirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/integrations/google/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline', // ask for a refresh token
    prompt: 'consent', // force a refresh token even on re-connect
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_ENDPOINT}?${p.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  origin: string,
): Promise<{ refreshToken?: string; accessToken?: string }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri(origin),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data: any = await res.json();
  return { refreshToken: data.refresh_token, accessToken: data.access_token };
}

/** Which Google account authorized us (for the SMTP username / From address). */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data: any = await res.json().catch(() => null);
  return data?.email ?? null;
}
