import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getOptions } from '@/lib/options';
import { prisma } from '@/lib/prisma';
import MultiPendingReview from '@/components/MultiPendingReview';
import type { ImportLine } from '@/lib/statement-parse';

export const dynamic = 'force-dynamic';

export default async function MultiReviewPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const user = await getSession();
  if (!user) redirect('/login');
  const sp = await searchParams;
  const ids = (sp.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const [pendingRaw, expenseCategories, incomeCategories, clients] = await Promise.all([
    prisma.pendingImport.findMany({
      where: ids.length ? { id: { in: ids } } : {},
      orderBy: { createdAt: 'asc' },
      select: { id: true, accountType: true, accountLabel: true, currency: true, lines: true },
    }),
    getOptions('expenseCategory'),
    getOptions('incomeCategory'),
    prisma.client.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (pendingRaw.length === 0) redirect('/finance/import');

  const statements = pendingRaw.map((p) => ({
    id: p.id,
    accountType: p.accountType,
    accountLabel: p.accountLabel,
    currency: p.currency,
    lines: ((p.lines as any as ImportLine[]) ?? []),
  }));

  return (
    <div className="w-full min-w-0">
      <Link href="/finance/import" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700">
        <ArrowLeft size={14} /> All imports
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Review &amp; import {statements.length} statement{statements.length === 1 ? '' : 's'}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Check every line across the selected statements, then import them all in one step.</p>
      <MultiPendingReview statements={statements} expenseCategories={expenseCategories} incomeCategories={incomeCategories} clients={clients} />
    </div>
  );
}
