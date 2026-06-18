import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const EPOCH = new Date(0);
const THIRTY_DAYS = 30 * 86_400_000;
const noStore = { headers: { 'Cache-Control': 'no-store' } };

function convoName(isGroup: boolean, title: string | null, others: { name: string }[]) {
  return isGroup ? title || others.map((o) => o.name).join(', ') || 'Group' : others[0]?.name ?? 'You';
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ conversations: [], totalUnread: 0 }, { status: 401 });
  const me = session.id;
  const sp = req.nextUrl.searchParams;
  const conversationId = sp.get('conversationId');
  const search = (sp.get('search') ?? '').trim();
  const deleted = sp.get('deleted') === '1';

  // ── Single thread: messages + mark read ──
  if (conversationId) {
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: me } },
    });
    if (!membership) return NextResponse.json({ messages: [], members: [] }, { status: 403 });

    const [messages, members] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 300,
        select: { id: true, body: true, createdAt: true, senderId: true, sender: { select: { name: true } }, attachmentUrl: true, attachmentName: true, attachmentType: true },
      }),
      prisma.conversationMember.findMany({ where: { conversationId }, select: { user: { select: { id: true, name: true } } } }),
    ]);
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: me } },
      data: { lastReadAt: new Date() },
    });
    await prisma.notification.updateMany({
      where: { userId: me, type: 'message', href: `/messages?c=${conversationId}`, read: false },
      data: { read: true },
    });

    return NextResponse.json(
      {
        messages: messages.map((m) => ({
          id: m.id,
          body: m.body,
          createdAt: m.createdAt,
          senderId: m.senderId,
          senderName: m.sender?.name ?? 'Removed',
          mine: m.senderId === me,
          attachmentUrl: m.attachmentUrl,
          attachmentName: m.attachmentName,
          attachmentType: m.attachmentType,
        })),
        members: members.map((x) => x.user),
      },
      noStore,
    );
  }

  // ── Global message search ──
  if (search) {
    const memberConvoIds = (await prisma.conversationMember.findMany({ where: { userId: me, deletedAt: null }, select: { conversationId: true } })).map((m) => m.conversationId);
    if (!memberConvoIds.length) return NextResponse.json({ results: [] }, noStore);
    const [msgs, convos] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: { in: memberConvoIds }, body: { contains: search, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { id: true, body: true, createdAt: true, conversationId: true, sender: { select: { name: true } } },
      }),
      prisma.conversation.findMany({
        where: { id: { in: memberConvoIds } },
        select: { id: true, isGroup: true, title: true, members: { select: { user: { select: { id: true, name: true } } } } },
      }),
    ]);
    const nameById = new Map(convos.map((c) => [c.id, convoName(c.isGroup, c.title, c.members.map((m) => m.user).filter((u) => u.id !== me))]));
    return NextResponse.json(
      {
        results: msgs.map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          conversationName: nameById.get(m.conversationId) ?? 'Conversation',
          senderName: m.sender?.name ?? '',
          body: m.body,
          createdAt: m.createdAt,
        })),
      },
      noStore,
    );
  }

  // ── Lazy purge: permanently drop memberships soft-deleted over 30 days ago ──
  await prisma.conversationMember.deleteMany({ where: { userId: me, deletedAt: { lt: new Date(Date.now() - THIRTY_DAYS) } } });

  // ── Conversation list (active, or recently-deleted) ──
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: me, deletedAt: deleted ? { not: null } : null },
    include: {
      conversation: {
        include: {
          members: { include: { user: { select: { id: true, name: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true, attachmentName: true, sender: { select: { name: true } } } },
        },
      },
    },
  });

  const unreadCounts = await Promise.all(
    memberships.map((m) =>
      deleted
        ? Promise.resolve(0)
        : prisma.message.count({ where: { conversationId: m.conversationId, senderId: { not: me }, createdAt: { gt: m.lastReadAt ?? EPOCH } } }),
    ),
  );

  const conversations = memberships
    .map((m, i) => {
      const c = m.conversation;
      const others = c.members.map((x) => x.user).filter((u) => u.id !== me);
      const last = c.messages[0];
      return {
        id: c.id,
        isGroup: c.isGroup,
        name: convoName(c.isGroup, c.title, others),
        members: c.members.map((x) => x.user),
        unread: unreadCounts[i],
        updatedAt: c.updatedAt,
        deletedAt: m.deletedAt,
        lastMessage: last
          ? { body: last.body || (last.attachmentName ? `📎 ${last.attachmentName}` : ''), createdAt: last.createdAt, senderName: last.sender?.name ?? '' }
          : null,
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const totalUnread = unreadCounts.reduce((s, n) => s + n, 0);
  return NextResponse.json({ conversations, totalUnread }, noStore);
}
