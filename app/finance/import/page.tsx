import Link from 'next/link';
import { ArrowLeft, Camera } from 'lucide-react';
import { getOptions, ensureExpenseCategories } from '@/lib/options';
import StatementImport from '@/components/StatementImport';

export const dynamic = 'force-dynamic';

export default async function ImportStatementPage() {
  await ensureExpenseCategories();
  const [currencies, categories] = await Promise.all([
    getOptions('currency'),
    getOptions('expenseCategory'),
  ]);

  return (
    <div>
      <Link href="/finance?tab=expenses" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700">
        <ArrowLeft size={14} /> Finance
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import statement</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload a bank or credit-card statement — CSV or PDF — review the lines, and add them to expenses.
          </p>
        </div>
        <Link href="/finance/bill" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-brand">
          <Camera size={15} /> Scan a single bill instead
        </Link>
      </div>

      <StatementImport currencies={currencies} categories={categories} />
    </div>
  );
}
