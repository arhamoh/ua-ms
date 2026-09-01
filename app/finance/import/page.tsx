import Link from 'next/link';
import { ArrowLeft, Camera, FileText, Clock, ChevronRight } from 'lucide-react';
import { getOptions } from '@/lib/options';
import { prisma } from '@/lib/prisma';
import FadeIn from '@/components/FadeIn';
import ImportUpload from '@/components/ImportUpload';
import { STATEMENT_ACCOUNT_TYPE_LABELS } from '@/lib/enums';

export const dynamic = 'force-dynamic';

export default async function ImportStatementPage() {
  const [currencies, rules, pendingRaw] = await Promise.all([
    getOptions('currency'),
    prisma.txnRule.findMany({ orderBy: { hits: 'desc' }, select: { matchKey: true, type: true, category: true, title: true } }),
    prisma.pendingImport.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, fileName: true, accountType: true, accountLabel: true, currency: true, createdAt: true, lines: true },
    }),
  ]);

  const pending = pendingRaw.map((p) => {
    const lines = (p.lines as any[]) ?? [];
    const included = lines.filter((l) => l?.include && Number(l?.amount) > 0);
    return {
      id: p.id, fileName: p.fileName, accountType: p.accountType, accountLabel: p.accountLabel,
      createdAt: p.createdAt, count: included.length, total: lines.length,
    };
  });

  return (
    <div>
      <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700">
        <ArrowLeft size={14} /> Finance
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import statement</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload one or several statements — each is saved as a pending import you can review in its own tab and finish later.
          </p>
        </div>
        <Link href="/finance/bill" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-brand">
          <Camera size={15} /> Scan a single bill instead
        </Link>
      </div>

      <FadeIn><ImportUpload currencies={currencies} rules={rules} /></FadeIn>

      {pending.length > 0 && (
        <FadeIn delay={0.06}>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <Clock size={16} className="text-amber-500" />
              <h2 className="text-sm font-semibold">Pending imports</h2>
              <span className="text-xs text-slate-400">· {pending.length}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {pending.map((p) => (
                <Link key={p.id} href={`/finance/import/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText size={16} className="shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">{p.accountLabel}</div>
                      <div className="truncate text-xs text-slate-400">{p.fileName} · {STATEMENT_ACCOUNT_TYPE_LABELS[p.accountType] ?? p.accountType}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{p.count} to import</span>
                    <span className="text-xs text-slate-400">{p.createdAt.toISOString().slice(0, 10)}</span>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
