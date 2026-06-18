import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Messenger from '@/components/Messenger';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const users = await prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Messages</h1>
      <Messenger me={{ id: session.id, name: session.name }} users={users} />
    </div>
  );
}
