import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Mail, Building2, CalendarClock, CheckCircle2 } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import FadeIn from '@/components/FadeIn';
import LetterUpload from '@/components/LetterUpload';

export const dynamic = 'force-dynamic';

function fmt(d: Date | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

export default async function LettersPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!user.roles.includes('SUPER_ADMIN')) redirect('/');

  const letters = await prisma.letter.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, sender: true, dueDate: true, status: true, language: true, createdAt: true,
      tasks: { select: { status: true } },
    },
  });

  return (
    <div>
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight">Letters &amp; documents</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a letter (e.g. a government notice). It's translated to English, summarized, and turned into a board of
          tasks — one board per document.
        </p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="mt-6"><LetterUpload /></div>
      </FadeIn>

      {letters.length > 0 && (
        <FadeIn delay={0.1}>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {letters.map((l) => {
              const total = l.tasks.length;
              const done = l.tasks.filter((t) => t.status === 'DONE').length;
              const allDone = total > 0 && done === total;
              const due = fmt(l.dueDate);
              const overdue = due && !allDone && new Date(`${due}T23:59:59`) < new Date();
              return (
                <Link key={l.id} href={`/letters/${l.id}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand/40 hover:shadow">
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-light text-brand"><Mail size={18} /></span>
                    {l.language && l.language !== 'en' && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">{l.language}→en</span>
                    )}
                  </div>
                  <h2 className="mt-3 line-clamp-2 text-sm font-semibold text-slate-800 group-hover:text-brand">{l.title}</h2>
                  {l.sender && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Building2 size={12} /> {l.sender}</p>}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className={`inline-flex items-center gap-1 ${allDone ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {allDone ? <CheckCircle2 size={13} /> : null}
                      {total > 0 ? `${done}/${total} done` : (l.status === 'FAILED' ? 'No tasks' : '0 tasks')}
                    </span>
                    {due && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${overdue ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                        <CalendarClock size={11} /> {due}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
