import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getOptions } from '@/lib/options';
import StatementImport from '@/components/StatementImport';

export const dynamic = 'force-dynamic';

export default async function ImportStatementPage() {
  const [currencies, categories] = await Promise.all([
    getOptions('currency'),
    getOptions('expenseCategory'),
  ]);

  return (
    <div>
      <Link href="/finance?tab=expenses" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700">
        <ArrowLeft size={14} /> Finance
      </Link>
      <div className="mb-6 mt-2">
        <h1 className="text-2xl font-bold tracking-tight">Import statement</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a bank or credit-card CSV, review the lines, and add them to expenses.
        </p>
      </div>

      <StatementImport currencies={currencies} categories={categories} />
    </div>
  );
}
