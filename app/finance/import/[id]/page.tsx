import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getOptions } from '@/lib/options';
import { prisma } from '@/lib/prisma';
import PendingReview from '@/components/PendingReview';
import type { ImportLine } from '@/lib/statement-parse';

export const dynamic = 'force-dynamic';

export default async function PendingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) redirect('/login');

  const { id } = await params;
  const [pending, allPending, expenseCategories, incomeCategories, currencies, clients] = await Promise.all([
    prisma.pendingImport.findUnique({
      where: { id },
      select: { id: true, fileName: true, accountType: true, accountLabel: true, currency: true, note: true, lines: true },
    }),
    prisma.pendingImport.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, accountLabel: true, fileName: true } }),
    getOptions('expenseCategory'),
    getOptions('incomeCategory'),
    getOptions('currency'),
    prisma.client.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!pending) notFound();

  return (
    <div>
      <Link href="/finance/import" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700">
        <ArrowLeft size={14} /> All imports
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Review import</h1>
      <p className="mt-1 text-sm text-slate-500">{pending.fileName}</p>

      {/* Tabs: one per pending statement */}
      {allPending.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
          {allPending.map((p) => (
            <Link
              key={p.id}
              href={`/finance/import/${p.id}`}
              className={`shrink-0 whitespace-nowrap rounded-t-lg px-3 py-1.5 text-sm font-medium ${
                p.id === pending.id ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title={p.fileName}
            >
              {p.accountLabel}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <PendingReview
          pending={{
            id: pending.id,
            fileName: pending.fileName,
            accountType: pending.accountType,
            accountLabel: pending.accountLabel,
            currency: pending.currency,
            note: pending.note,
            lines: (pending.lines as any as ImportLine[]) ?? [],
          }}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          currencies={currencies}
          clients={clients}
        />
      </div>
    </div>
  );
}
