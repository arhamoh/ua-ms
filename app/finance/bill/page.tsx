import Link from 'next/link';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { getOptions, ensureExpenseCategories } from '@/lib/options';
import { getRatesToCad } from '@/lib/fx';
import BillScan from '@/components/BillScan';

export const dynamic = 'force-dynamic';

export default async function ScanBillPage() {
  await ensureExpenseCategories();
  const [currencies, categories, rates] = await Promise.all([
    getOptions('currency'),
    getOptions('expenseCategory'),
    getRatesToCad(),
  ]);

  return (
    <div>
      <Link href="/finance?tab=expenses" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700">
        <ArrowLeft size={14} /> Finance
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scan a bill</h1>
          <p className="mt-1 text-sm text-slate-500">
            Photograph or upload a bill / receipt — it’s read automatically and added to expenses in CAD.
          </p>
        </div>
        <Link href="/finance/import" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-brand">
          <FileSpreadsheet size={15} /> Import a CSV statement instead
        </Link>
      </div>

      <BillScan currencies={currencies} categories={categories} rates={rates} />
    </div>
  );
}
