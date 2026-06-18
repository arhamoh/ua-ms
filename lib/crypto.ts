import crypto from 'crypto';

// Symmetric encryption for stored secrets (the login vault). Key is derived from
// CREDENTIALS_SECRET (or AUTH_SECRET as a fallback) so no extra config is needed.
// NOTE: rotating the secret makes existing stored passwords undecryptable.
const SECRET =
  process.env.CREDENTIALS_SECRET ||
  process.env.AUTH_SECRET ||
  'ua-agency-dev-fallback-secret-please-set-AUTH_SECRET';

const KEY = crypto.createHash('sha256').update(SECRET).digest(); // 32 bytes

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  try {
    const [ivB, tagB, dataB] = payload.split(':');
    if (!ivB || !tagB || !dataB) return '';
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return '';
  }
}
