import { prisma } from '@/lib/prisma';

type NewNotif = { type: string; title: string; body?: string | null; href?: string | null };

// Best-effort: create a notification for each user. Never throws — notifications
// must never break the underlying action.
export async function notifyUsers(userIds: (string | null | undefined)[], n: NewNotif) {
  try {
    const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
    if (!ids.length) return;
    await prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        href: n.href ?? null,
      })),
    });
  } catch {
    /* ignore */
  }
}

// Resolve @mentions in a free-text body to user ids. Matches a token against a
// user's first name, their full name with spaces removed, or a length-3+ prefix
// of it (e.g. "@aisha", "@aishakhan").
export async function resolveMentions(body: string): Promise<string[]> {
  const tokens = Array.from(body.matchAll(/@([\p{L}][\p{L}\d._-]*)/gu)).map((m) => m[1].toLowerCase());
  if (!tokens.length) return [];
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const matched = new Set<string>();
  for (const u of users) {
    const full = u.name.toLowerCase().replace(/\s+/g, '');
    const first = u.name.toLowerCase().split(/\s+/)[0];
    for (const t of tokens) {
      if (first === t || full === t || (t.length >= 3 && full.startsWith(t))) {
        matched.add(u.id);
        break;
      }
    }
  }
  return Array.from(matched);
}
