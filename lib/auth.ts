import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

// NOTE: set AUTH_SECRET in the environment (Railway). The fallback only exists
// so the app boots in dev / before the secret is configured.
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'ua-agency-dev-fallback-secret-please-set-AUTH_SECRET',
);

export const SESSION_COOKIE = 'ua_session';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ name: user.name, email: user.email, roles: user.roles })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      id: payload.sub as string,
      name: (payload.name as string) ?? '',
      email: (payload.email as string) ?? '',
      roles: (payload.roles as string[]) ?? [],
    };
  } catch {
    return null;
  }
}
