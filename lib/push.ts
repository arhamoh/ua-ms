import 'server-only';
import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { getSecret, setSecret, hydrateSecrets } from '@/lib/secrets';

// Web Push (VAPID) so the platform can notify a phone even when it's closed.
// Keys are auto-provisioned on first use and stored (encrypted) so they stay
// stable — changing them would invalidate every existing subscription.

let configured = false;

async function ensureVapid(): Promise<{ publicKey: string; subject: string } | null> {
  await hydrateSecrets();
  let pub = await getSecret('VAPID_PUBLIC_KEY');
  let priv = await getSecret('VAPID_PRIVATE_KEY');
  const subject = (await getSecret('VAPID_SUBJECT')) || 'mailto:notifications@keel.app';

  if (!pub || !priv) {
    // First run: generate a stable keypair and persist it.
    try {
      const keys = webpush.generateVAPIDKeys();
      await setSecret('VAPID_PUBLIC_KEY', keys.publicKey);
      await setSecret('VAPID_PRIVATE_KEY', keys.privateKey);
      pub = keys.publicKey;
      priv = keys.privateKey;
    } catch {
      return null;
    }
  }
  if (!pub || !priv) return null;
  if (!configured) {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  }
  return { publicKey: pub, subject };
}

/** The public VAPID key the browser needs to subscribe (safe to expose). */
export async function getVapidPublicKey(): Promise<string | null> {
  const v = await ensureVapid();
  return v?.publicKey ?? null;
}

/** Persist a device's push subscription for a user. */
export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return;
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

type PushPayload = { title: string; body?: string; url?: string };

/** Send a push to every device of the given users. Best-effort; prunes dead subs. */
export async function sendPush(userIds: (string | null | undefined)[], payload: PushPayload): Promise<void> {
  try {
    const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
    if (!ids.length) return;
    const v = await ensureVapid();
    if (!v) return;
    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } } });
    if (!subs.length) return;
    const body = JSON.stringify({ title: payload.title, body: payload.body ?? '', url: payload.url ?? '/' });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
        } catch (e: any) {
          // 404/410 = subscription gone; drop it so we stop trying.
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } }).catch(() => {});
          }
        }
      }),
    );
  } catch {
    /* never let notifications break the caller */
  }
}
