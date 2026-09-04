import 'server-only';

// Unified "Connect Google" — one OAuth consent that powers Gmail (send email),
// Google Calendar, Google Meet, and Google Drive from a single connected
// Workspace account. This is what makes white-label onboarding one click.
//
// The admin enters an OAuth client id/secret once (from Google Cloud); each
// person who connects grants these scopes and we store a refresh token, from
// which every Google feature mints access tokens.

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
];

export function googleClientConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function googleConnected(): boolean {
  return Boolean(process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CONNECTED_EMAIL);
}

export function googleConnectedEmail(): string | null {
  return process.env.GOOGLE_CONNECTED_EMAIL || null;
}

/**
 * The app's PUBLIC origin, derived from proxy headers — not req.nextUrl.origin,
 * which behind Railway's proxy returns the internal address (localhost:8080).
 * APP_URL overrides everything when set.
 */
export function originFromRequest(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const h = req.headers;
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  const proto = (h.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  if (host && !/^(localhost|127\.)/.test(host)) return `${proto}://${host}`;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return host ? `${proto}://${host}` : '';
}

export function redirectUri(origin: string): string {
  let base = origin;
  // Behind a TLS-terminating proxy (e.g. Railway) the origin can come back as
  // http:// — but Google matches the registered https URI exactly, so coerce it
  // (localhost stays http for local dev).
  if (base.startsWith('http://') && !/localhost|127\.0\.0\.1/.test(base)) {
    base = `https://${base.slice('http://'.length)}`;
  }
  return `${base.replace(/\/$/, '')}/api/integrations/google/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_ENDPOINT}?${p.toString()}`;
}

export async function exchangeCode(code: string, origin: string): Promise<{ refreshToken?: string; accessToken?: string }> {
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
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const d: any = await res.json();
  return { refreshToken: d.refresh_token, accessToken: d.access_token };
}

export async function fetchUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const d: any = await res.json().catch(() => null);
  return d?.email ?? null;
}

// In-process access-token cache (refresh tokens are long-lived; access tokens ~1h).
let cached: { token: string; exp: number } | null = null;
export function resetGoogleTokenCache() {
  cached = null;
}

/** A fresh Google access token from the stored refresh token, cached until it
 *  nears expiry. Throws if Google isn't connected. */
export async function getAccessToken(): Promise<string> {
  if (!googleConnected()) throw new Error('Google is not connected.');
  if (cached && Date.now() < cached.exp - 60_000) return cached.token;
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  const d: any = await res.json();
  cached = { token: d.access_token, exp: Date.now() + (d.expires_in ?? 3600) * 1000 };
  return d.access_token;
}

/** Live check that the connection works — reads the connected account's profile. */
export async function testGoogleConnection(): Promise<{ ok: boolean; message: string }> {
  if (!googleClientConfigured()) return { ok: false, message: 'Add the OAuth client ID & secret first.' };
  if (!googleConnected()) return { ok: false, message: 'Not connected — click Connect Google.' };
  try {
    const token = await getAccessToken();
    const email = await fetchUserEmail(token);
    return { ok: true, message: `Connected as ${email ?? googleConnectedEmail()}.` };
  } catch (e: any) {
    return { ok: false, message: e?.message?.slice(0, 200) ?? 'Connection failed.' };
  }
}
