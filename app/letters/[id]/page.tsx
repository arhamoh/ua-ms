import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft, Building2, Hash, CalendarClock, FileText, Languages, AlertTriangle, FileDown } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteLetter } from '@/app/actions';
import LetterBoard from '@/components/LetterBoard';
import RowActions from '@/components/RowActions';
import FadeIn from '@/components/FadeIn';

export const dynamic = 'force-dynamic';

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export default async function LetterBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!user.roles.includes('SUPER_ADMIN')) redirect('/');

  const { id } = await params;
  const [letter, statementRows] = await Promise.all([
    prisma.letter.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: [{ status: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
          include: { attachments: { orderBy: { createdAt: 'asc' } } },
        },
      },
    }),
    prisma.statement.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, fileName: true, accountLabel: true, accountType: true, periodLabel: true },
    }),
  ]);
  if (!letter) notFound();

  const tasks = letter.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    titleFr: t.titleFr,
    detail: t.detail,
    detailFr: t.detailFr,
    status: t.status,
    dueDate: iso(t.dueDate),
    response: t.response,
    attachments: t.attachments.map((a) => ({ id: a.id, fileName: a.fileName, kind: a.kind, reportKey: a.reportKey ?? null })),
  }));
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const ymOf = (src: string) => {
    const t = (src || '').toLowerCase();
    const y = t.match(/(20\d{2})/);
    const mi = MONTHS.findIndex((m) => t.includes(m));
    return { year: y ? Number(y[1]) : 0, month: mi >= 0 ? mi + 1 : 0 };
  };
  const statements = statementRows.map((s) => {
    const { year, month } = ymOf(s.periodLabel || s.fileName);
    return {
      id: s.id,
      fileName: s.fileName,
      accountType: s.accountType,
      label: [s.accountLabel, s.periodLabel].filter(Boolean).join(' · ') || s.fileName,
      year,
      month,
    };
  });
  const totalAttachments = tasks.reduce((n, t) => n + t.attachments.length, 0);
  const dueDate = iso(letter.dueDate);
  const isFrench = letter.language && letter.language !== 'en';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/letters" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Letters
        </Link>
        <RowActions deleteAction={deleteLetter.bind(null, letter.id)} label="document" />
      </div>

      <FadeIn>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight">{letter.title}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {letter.sender && <span className="inline-flex items-center gap-1"><Building2 size={12} /> {letter.sender}</span>}
                {letter.reference && <span className="inline-flex items-center gap-1"><Hash size={12} /> {letter.reference}</span>}
                {iso(letter.docDate) && <span>Dated {iso(letter.docDate)}</span>}
                {isFrench && <span className="inline-flex items-center gap-1"><Languages size={12} /> {letter.language}→en</span>}
                {dueDate && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700"><CalendarClock size={12} /> Due {dueDate}</span>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <a href={`/api/letters/${letter.id}/package`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark">
                <FileDown size={15} /> Submission PDF
              </a>
              <a href={`/api/letters/${letter.id}/file`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-brand">
                <FileText size={15} /> View original
              </a>
            </div>
          </div>

          {letter.errorNote && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{letter.errorNote}</span>
            </div>
          )}

          {letter.summary && (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{letter.summary}</p>
            </div>
          )}

          {letter.translation && (
            <details className="mt-3 group">
              <summary className="cursor-pointer list-none text-sm font-medium text-brand hover:underline">
                Read full English translation ▾
              </summary>
              <div className="mt-2 max-h-[420px] overflow-auto whitespace-pre-line rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">
                {letter.translation}
              </div>
            </details>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.06}>
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Tasks</h2>
            <span className="text-xs text-slate-400">
              Answer each question and attach documents — then generate the submission PDF{totalAttachments > 0 ? ` (${totalAttachments} attached)` : ''}.
            </span>
          </div>
          <LetterBoard letterId={letter.id} tasks={tasks} statements={statements} />
        </div>
      </FadeIn>
    </div>
  );
}
