'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Plus, UserPlus, Landmark, CreditCard, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { savePendingImport, commitSelectedPendingImports, addOptionCategory, quickAddClient } from '@/app/actions';
import type { ImportLine } from '@/lib/statement-parse';
import { ruleKey } from '@/lib/txnrules';

type Opt = { value: string; label: string };
type Client = { id: string; name: string };
type St = { id: string; accountLabel: string; accountType: string; currency: string; lines: ImportLine[] };
type Row = ImportLine & { _sid: string };

const mini = 'rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none';

export default function MultiPendingReview({
  statements,
  expenseCategories,
  incomeCategories,
  clients: initialClients,
}: {
  statements: St[];
  expenseCategories: Opt[];
  incomeCategories: Opt[];
  clients: Client[];
}) {
  const router = useRouter();
  const [pendingTx, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => statements.flatMap((s) => s.lines.map((l) => ({ ...l, _sid: s.id }))));
  const [expCats, setExpCats] = useState<Opt[]>(expenseCategories);
  const [incCats, setIncCats] = useState<Opt[]>(incomeCategories);
  const [clients, setClients] = useState<Client[]>(initialClients);

  const [catModal, setCatModal] = useState<{ i: number; type: string } | null>(null);
  const [catName, setCatName] = useState('');
  const [clientModal, setClientModal] = useState<{ i: number } | null>(null);
  const [agency, setAgency] = useState('');
  const [contact, setContact] = useState('');

  const meta = useMemo(() => new Map(statements.map((s) => [s.id, s])), [statements]);
  const sortedExp = useMemo(() => [...expCats].sort((a, b) => a.label.localeCompare(b.label)), [expCats]);
  const sortedInc = useMemo(() => [...incCats].sort((a, b) => a.label.localeCompare(b.label)), [incCats]);

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const keyOf = (r: Row) => ruleKey(r.rawDesc || r.title || '');
  // Cascade a field to same-statement rows sharing the same description + old value.
  const cascade = <K extends keyof ImportLine>(i: number, field: K, value: ImportLine[K]) => {
    setRows((rs) => {
      const key = keyOf(rs[i]);
      const sid = rs[i]._sid;
      const oldVal = rs[i][field];
      return rs.map((r, idx) => {
        if (idx === i) return { ...r, [field]: value };
        if (r._sid === sid && key.length >= 3 && keyOf(r) === key && r[field] === oldVal) return { ...r, [field]: value };
        return r;
      });
    });
  };

  const onTypeChange = (i: number, value: string) => {
    const type = value as ImportLine['type'];
    setRows((rs) => {
      const key = keyOf(rs[i]);
      const sid = rs[i]._sid;
      const oldType = rs[i].type;
      return rs.map((r, idx) => {
        const target = idx === i || (r._sid === sid && key.length >= 3 && keyOf(r) === key && r.type === oldType);
        if (!target) return r;
        const patch: Partial<Row> = { type };
        if (type === 'transfer') { patch.tax = 'none'; patch.clientId = null; }
        else if (type !== 'income') patch.clientId = null;
        return { ...r, ...patch };
      });
    });
  };

  const onCatChange = (i: number, type: string, value: string) => {
    if (value === '__new__') { setCatName(''); setCatModal({ i, type }); return; }
    cascade(i, 'category', value);
  };
  const onClientChange = (i: number, value: string) => {
    if (value === '__new__') { setAgency(''); setContact(''); setClientModal({ i }); return; }
    setRow(i, { clientId: value || null });
  };

  const submitNewCat = () => {
    if (!catModal) return;
    const name = catName.trim();
    if (!name) return;
    const { i, type } = catModal;
    start(async () => {
      const opt = await addOptionCategory(type === 'income' ? 'incomeCategory' : 'expenseCategory', name);
      if (opt) {
        const add = (p: Opt[]) => (p.some((c) => c.value === opt.value) ? p : [...p, opt]);
        if (type === 'income') setIncCats(add); else setExpCats(add);
        cascade(i, 'category', opt.value);
      }
      setCatModal(null); setCatName('');
    });
  };
  const submitNewClient = () => {
    if (!clientModal) return;
    const i = clientModal.i;
    start(async () => {
      const c = await quickAddClient(agency, contact);
      if (c) { setClients((p) => (p.some((x) => x.id === c.id) ? p : [...p, c])); setRow(i, { clientId: c.id }); }
      setClientModal(null); setAgency(''); setContact('');
    });
  };

  // Rows grouped by statement, in statement order then date.
  const ordered = useMemo(() => {
    const sidOrder = new Map(statements.map((s, idx) => [s.id, idx]));
    return rows.map((r, i) => ({ r, i })).sort((a, b) =>
      (sidOrder.get(a.r._sid)! - sidOrder.get(b.r._sid)!) || ((a.r.date && b.r.date) ? a.r.date.localeCompare(b.r.date) : 0),
    );
  }, [rows, statements]);

  const included = rows.filter((r) => r.include && Number(r.amount) > 0);
  const nExp = included.filter((r) => r.type === 'expense').length;
  const nInc = included.filter((r) => r.type === 'income').length;
  const nTrf = included.filter((r) => r.type === 'transfer').length;

  const commit = () =>
    start(async () => {
      const bySid = new Map<string, ImportLine[]>();
      for (const r of rows) {
        const { _sid, ...line } = r;
        if (!bySid.has(_sid)) bySid.set(_sid, []);
        bySid.get(_sid)!.push(line);
      }
      for (const [sid, lines] of bySid) await savePendingImport(sid, { lines });
      await commitSelectedPendingImports([...bySid.keys()]);
      router.push('/finance?tab=pnl');
      router.refresh();
    });

  return (
    <div className="w-full min-w-0 space-y-4 pb-24">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Previewing <span className="font-semibold">{statements.length}</span> statement{statements.length === 1 ? '' : 's'} ·{' '}
          <span className="text-slate-400">{nExp} exp · {nInc} inc{nTrf ? ` · ${nTrf} transfer` : ''} · {included.length} lines to import</span>
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-slate-50 text-center text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2.5 py-3"></th>
                <th className="px-2.5 py-3 font-medium">Date</th>
                <th className="px-2.5 py-3 font-medium">Type</th>
                <th className="px-2.5 py-3 font-medium">Title</th>
                <th className="px-2.5 py-3 font-medium">Category</th>
                <th className="px-2.5 py-3 font-medium">Client</th>
                <th className="px-2.5 py-3 font-medium">Tax</th>
                <th className="px-2.5 py-3 font-medium">Amount</th>
                <th className="px-2.5 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordered.map(({ r, i }, idx) => {
                const st = meta.get(r._sid)!;
                const showHead = idx === 0 || ordered[idx - 1].r._sid !== r._sid;
                return (
                  <Fragment key={i}>
                    {showHead && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={9} className="px-3 py-2 text-xs font-semibold text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            {st.accountType === 'CREDIT_CARD' ? <CreditCard size={13} className="text-slate-400" /> : <Landmark size={13} className="text-slate-400" />}
                            {st.accountLabel} <span className="font-normal text-slate-400">· {st.currency}</span>
                          </span>
                        </td>
                      </tr>
                    )}
                    <tr className={`${r.include ? '' : 'opacity-50'} hover:bg-slate-50`}>
                      <td className="px-2.5 py-2"><input type="checkbox" checked={r.include} onChange={(e) => setRow(i, { include: e.target.checked })} className="rounded border-slate-300" /></td>
                      <td className="px-2.5 py-2"><input type="date" value={r.date} onChange={(e) => setRow(i, { date: e.target.value })} className={`${mini} w-36`} /></td>
                      <td className="px-2.5 py-2">
                        <select value={r.type} onChange={(e) => onTypeChange(i, e.target.value)} className={`${mini} w-32 ${r.type === 'income' ? 'text-emerald-700' : r.type === 'transfer' ? 'text-indigo-700' : 'text-rose-700'}`}>
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </td>
                      <td className="px-2.5 py-2"><input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} className={`${mini} w-full min-w-[160px]`} /></td>
                      <td className="px-2.5 py-2">
                        <select value={r.category} onChange={(e) => onCatChange(i, r.type, e.target.value)} className={`${mini} w-40`}>
                          {!(r.type === 'income' ? incCats : expCats).some((c) => c.value === r.category) && r.category && <option value={r.category}>{r.category}</option>}
                          {(r.type === 'income' ? sortedInc : sortedExp).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          <option value="__new__">+ New category…</option>
                        </select>
                      </td>
                      <td className="px-2.5 py-2">
                        {r.type === 'income' ? (
                          <select value={r.clientId ?? ''} onChange={(e) => onClientChange(i, e.target.value)} className={`${mini} w-40 ${r.clientId ? 'text-slate-800' : 'text-slate-500'}`}>
                            <option value="">— unassigned —</option>
                            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            <option value="__new__">+ Quick-add client…</option>
                          </select>
                        ) : <span className="pl-2 text-slate-300">—</span>}
                      </td>
                      <td className="px-2.5 py-2">
                        {r.type === 'transfer' ? <span className="pl-2 text-slate-300">—</span> : (
                          <select value={r.tax} onChange={(e) => cascade(i, 'tax', e.target.value as ImportLine['tax'])} className={`${mini} w-32`}>
                            <option value="both">GST + QST</option>
                            <option value="gst">GST only</option>
                            <option value="none">No tax</option>
                          </select>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-right"><input type="number" min="0" step="any" value={r.amount} onChange={(e) => setRow(i, { amount: Number(e.target.value) || 0 })} className={`${mini} w-32 text-right tabular-nums`} /></td>
                      <td className="px-2.5 py-2"><input value={r.note ?? ''} onChange={(e) => setRow(i, { note: e.target.value })} placeholder="Optional" className={`${mini} w-full min-w-[140px]`} /></td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3">
          <Link href="/finance/import" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <ArrowLeft size={15} /> Back
          </Link>
          <button onClick={commit} disabled={pendingTx || included.length === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50">
            <Save size={15} /> {pendingTx ? 'Importing…' : `Import ${included.length} line${included.length === 1 ? '' : 's'} from ${statements.length} statement${statements.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>

      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !pendingTx && setCatModal(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">New {catModal.type === 'income' ? 'income' : 'expense'} category</h3>
            <input autoFocus value={catName} onChange={(e) => setCatName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitNewCat(); if (e.key === 'Escape') setCatModal(null); }} placeholder="e.g. Upwork payment" className={`${mini} mt-3 w-full`} />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCatModal(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={submitNewCat} disabled={pendingTx || !catName.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"><Plus size={14} /> Add</button>
            </div>
          </div>
        </div>
      )}
      {clientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !pendingTx && setClientModal(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">Quick-add client</h3>
            <p className="mt-0.5 text-xs text-slate-400">Fill either or both — agency (business) and/or contact name.</p>
            <label className="mt-3 block"><span className="mb-1 block text-xs font-medium text-slate-600">Agency / business name</span><input autoFocus value={agency} onChange={(e) => setAgency(e.target.value)} className={`${mini} w-full`} placeholder="Acme Media" /></label>
            <label className="mt-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Contact name</span><input value={contact} onChange={(e) => setContact(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitNewClient(); if (e.key === 'Escape') setClientModal(null); }} className={`${mini} w-full`} placeholder="Jane Doe" /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setClientModal(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={submitNewClient} disabled={pendingTx || (!agency.trim() && !contact.trim())} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"><UserPlus size={14} /> Add client</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
