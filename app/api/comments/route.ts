import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Comment threads for an entity (project / task / client) — unresolved first.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ threads: [] }, { status: 401 });
  const entityType = req.nextUrl.searchParams.get('entityType');
  const entityId = req.nextUrl.searchParams.get('entityId');
  if (!entityType || !entityId) return NextResponse.json({ threads: [] }, { status: 400 });

  const threads = await prisma.commentThread.findMany({
    where: { entityType, entityId },
    orderBy: [{ resolved: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      resolved: true,
      createdById: true,
      createdAt: true,
      comments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, body: true, createdAt: true, authorId: true, author: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json(
    {
      threads: threads.map((t) => ({
        id: t.id,
        resolved: t.resolved,
        createdById: t.createdById,
        comments: t.comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          authorId: c.authorId,
          authorName: c.author?.name ?? 'Removed',
        })),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
