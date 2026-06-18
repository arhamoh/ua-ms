import { KeyRound } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { canManageLogins } from '@/lib/enums';
import LoginsManager, { type LoginItem } from '@/components/LoginsManager';
import FadeIn from '@/components/FadeIn';

export const dynamic = 'force-dynamic';

export default async function LoginsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const session = await getSession();
  const manage = canManageLogins(session?.roles);

  // Managers see every login; everyone else only what's shared with them.
  const rows = await prisma.login.findMany({
    where: manage ? {} : { shares: { some: { userId: session?.id } } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      url: true,
      username: true,
      notes: true,
      createdBy: { select: { name: true } },
      shares: { select: { user: { select: { id: true, name: true } } } },
    },
  });

  // Never send the (encrypted) password to the client — it's fetched on reveal.
  const items: LoginItem[] = rows.map((l) => ({
    id: l.id,
    name: l.name,
    url: l.url,
    username: l.username,
    notes: l.notes,
    createdBy: l.createdBy?.name ?? null,
    sharedWith: l.shares.map((s) => ({ id: s.user.id, name: s.user.name })),
  }));

  const users = manage
    ? await prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, roles: true } })
    : [];

  return (
    <div>
      <FadeIn>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <KeyRound size={22} className="text-brand" /> Logins
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {manage
            ? 'Shared team credentials. Add logins and choose who can see each one — revoke anytime.'
            : 'Credentials shared with you. Reveal or copy a password when you need it.'}
        </p>
      </FadeIn>

      <div className="mt-6">
        <LoginsManager items={items} users={users} canManage={manage} focusId={focus ?? null} />
      </div>
    </div>
  );
}
