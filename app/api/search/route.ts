import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { canManageLogins } from '@/lib/enums';

export const dynamic = 'force-dynamic';

// Returns a lightweight index of searchable entities for the ⌘K palette.
export async function GET() {
  const session = await getSession();
  const manageLogins = canManageLogins(session?.roles);

  const [clients, projects, team, logins] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.project.findMany({
      select: { id: true, name: true, client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
      take: 100,
    }),
    // Only logins the user may see (no passwords). Managers see all.
    session
      ? prisma.login.findMany({
          where: manageLogins ? {} : { shares: { some: { userId: session.id } } },
          select: { id: true, name: true, username: true },
          orderBy: { name: 'asc' },
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json(
    {
      clients: clients.map((c) => ({ id: c.id, name: c.name })),
      projects: projects.map((p) => ({ id: p.id, name: p.name, sub: p.client.name })),
      team: team.map((u) => ({ id: u.id, name: u.name, sub: u.email })),
      logins: logins.map((l) => ({ id: l.id, name: l.name, sub: l.username ?? undefined })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
