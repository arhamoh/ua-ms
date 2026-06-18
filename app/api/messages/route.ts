import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const EPOCH = new Date(0);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ conversations: [], totalUnread: 0 }, { status: 401 });
  const me = session.id;
  const conversationId = req.nextUrl.searchParams.get('conversationId');

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
        take: 200,
        select: { id: true, body: true, createdAt: true, senderId: true, sender: { select: { name: true } } },
      }),
      prisma.conversationMember.findMany({
        where: { conversationId },
        select: { user: { select: { id: true, name: true } } },
      }),
    ]);
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: me } },
      data: { lastReadAt: new Date() },
    });
    // Clear the bell notification for this conversation once it's opened.
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
        })),
        members: members.map((x) => x.user),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // ── Conversation list with unread counts ──
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: me },
    include: {
      conversation: {
        include: {
          members: { include: { user: { select: { id: true, name: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true, sender: { select: { name: true } } } },
        },
      },
    },
  });

  const unreadCounts = await Promise.all(
    memberships.map((m) =>
      prisma.message.count({
        where: { conversationId: m.conversationId, senderId: { not: me }, createdAt: { gt: m.lastReadAt ?? EPOCH } },
      }),
    ),
  );

  const conversations = memberships
    .map((m, i) => {
      const c = m.conversation;
      const others = c.members.map((x) => x.user).filter((u) => u.id !== me);
      const name = c.isGroup ? c.title || others.map((o) => o.name).join(', ') || 'Group' : others[0]?.name ?? 'You';
      const last = c.messages[0];
      return {
        id: c.id,
        isGroup: c.isGroup,
        name,
        members: c.members.map((x) => x.user),
        unread: unreadCounts[i],
        updatedAt: c.updatedAt,
        lastMessage: last ? { body: last.body, createdAt: last.createdAt, senderName: last.sender?.name ?? '' } : null,
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const totalUnread = unreadCounts.reduce((s, n) => s + n, 0);
  return NextResponse.json({ conversations, totalUnread }, { headers: { 'Cache-Control': 'no-store' } });
}
