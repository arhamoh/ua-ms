import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Returns a lightweight index of searchable entities for the ⌘K palette.
export async function GET() {
  const [clients, projects, team] = await Promise.all([
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
  ]);

  return NextResponse.json(
    {
      clients: clients.map((c) => ({ id: c.id, name: c.name })),
      projects: projects.map((p) => ({ id: p.id, name: p.name, sub: p.client.name })),
      team: team.map((u) => ({ id: u.id, name: u.name, sub: u.email })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
