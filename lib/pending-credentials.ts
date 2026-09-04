// A tiny, in-memory, one-shot stash for showing a newly-created member's
// credentials back to the admin who created them — needed while welcome emails
// are disabled, since the temp password is never stored in plaintext.
//
// Keyed by the admin's session user id; consumed on read; expires after a few
// minutes. Same in-process pattern the poll job uses — fine on Railway's
// single long-lived Node server (never persisted, never shared to the client
// except once, in the page the admin is redirected to).

export interface StashedCredentials {
  name: string;
  username: string;
  tempPassword: string;
  loginUrl: string;
  emailed: boolean;
  at: number;
}

const store = new Map<string, StashedCredentials>();
const TTL_MS = 5 * 60 * 1000;

export function stashCredentials(adminId: string, creds: Omit<StashedCredentials, 'at'>): void {
  store.set(adminId, { ...creds, at: Date.now() });
}

/** Read and remove the stashed credentials for this admin, if still fresh. */
export function takeCredentials(adminId: string): StashedCredentials | null {
  const c = store.get(adminId);
  if (!c) return null;
  store.delete(adminId);
  if (Date.now() - c.at > TTL_MS) return null;
  return c;
}
