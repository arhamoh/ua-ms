import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import TimeEntryEditForm from '@/components/TimeEntryEditForm';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER'];

export default async function EditTimeEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect('/login');

  const entry = await prisma.timeEntry.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });
  if (!entry) notFound();

  const isAdmin = session.roles.some((r) => ADMIN_ROLES.includes(r));
  if (!isAdmin && entry.userId !== session.id) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-800">
        You can only edit your own sessions. <Link href="/time" className="font-medium underline">Back to your time</Link>.
      </div>
    );
  }

  // Only allow returning to the time pages.
  const from = sp.from === '/time/report' ? '/time/report' : '/time';

  return (
    <div>
      <Link href={from} className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700">
        <ArrowLeft size={14} /> Back
      </Link>
      <div className="mb-6 mt-2">
        <h1 className="text-2xl font-bold tracking-tight">Edit session</h1>
        <p className="mt-1 text-sm text-slate-500">
          {entry.user.name} · adjust the check-in / check-out times or the tasks logged. Times are shown in your local timezone.
        </p>
      </div>

      <TimeEntryEditForm
        id={entry.id}
        from={from}
        checkInAt={entry.checkInAt.toISOString()}
        checkOutAt={entry.checkOutAt ? entry.checkOutAt.toISOString() : null}
        tasks={entry.tasks ?? ''}
        notes={entry.notes ?? ''}
      />
    </div>
  );
}
