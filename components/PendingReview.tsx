'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2, Plus, UserPlus } from 'lucide-react';
import {
  savePendingImport, commitPendingImport, deletePendingImport, addOptionCategory, quickAddClient,
} from '@/app/actions';
import { STATEMENT_ACCOUNT_TYPES, STATEMENT_ACCOUNT_TYPE_LABELS } from '@/lib/enums';
import type { ImportLine } from '@/lib/statement-parse';
import ConfirmModal from './ConfirmModal';

type Opt = { value: string; label: string };
type Client = { id: string; name: string };

const mini = 'rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none';

export default function PendingReview({
  pending,
  expenseCategories,
  incomeCategories,
  currencies,
  clients: initialClients,
}: {
  pending: { id: string; fileName: string; accountType: string; accountLabel: string; currency: string; note: string | null; lines: ImportLine[] };
  expenseCategories: Opt[];
  incomeCategories: Opt[];
  currencies: Opt[];
  clients: Client[];
}) {
  const router = useRouter();
  const [pendingTx, start] = useTransition();
  const [lines, setLines] = useState<ImportLine[]>(pending.lines);
  const [acctType, setAcctType] = useState(pending.accountType);
  const [acctLabel, setAcctLabel] = useState(pending.accountLabel);
  const [currency, setCurrency] = useState(pending.currency);
  const [note, setNote] = useState(pending.note ?? '');
  const [expCats, setExpCats] = useState<Opt[]>(expenseCategories);
  const [incCats, setIncCats] = useState<Opt[]>(incomeCategories);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [catModal, setCatModal] = useState<{ i: number; type: string } | null>(null);
  const [catName, setCatName] = useState('');
  const [clientModal, setClientModal] = useState<{ i: number } | null>(null);
  const [agency, setAgency] = useState('');
  const [contact, setContact] = useState('');

  const sortedExp = useMemo(() => [...expCats].sort((a, b) => a.label.localeCompare(b.label)), [expCats]);
  const sortedInc = useMemo(() => [...incCats].sort((a, b) => a.label.localeCompare(b.label)), [incCats]);

  const setLine = (i: number, patch: Partial<ImportLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const order = useMemo(
    () => lines.map((l, i) => ({ l, i })).sort((a, b) => (a.l.date && b.l.date ? a.l.date.localeCompare(b.l.date) : a.l.date ? -1 : b.l.date ? 1 : 0)),
    [lines],
  );

  const included = lines.filter((l) => l.include && Number(l.amount) > 0);
  const nExp = included.filter((l) => l.type === 'expense').length;
  const nInc = included.filter((l) => l.type === 'income').length;
  const nTrf = included.filter((l) => l.type === 'transfer').length;
  const total = included.reduce((s, l) => s + Number(l.amount), 0);

  // Switching type: transfers carry no tax and no client; only income has a client.
  const onTypeChange = (i: number, value: string) => {
    const type = value as ImportLine['type'];
    const patch: Partial<ImportLine> = { type };
    if (type === 'transfer') { patch.tax = 'none'; patch.clientId = null; }
    else if (type !== 'income') patch.clientId = null;
    setLine(i, patch);
  };

  const meta = () => ({ accountType: acctType, accountLabel: acctLabel, currency, note });

  const save = () =>
    start(async () => {
      await savePendingImport(pending.id, { lines, ...meta() });
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });

  const commit = () =>
    start(async () => {
      await savePendingImport(pending.id, { lines, ...meta() });
      await commitPendingImport(pending.id);
    });

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const remove = () => setConfirmDiscard(true);
  const doDiscard = () =>
    start(async () => {
      await deletePendingImport(pending.id);
    });

  const applyTaxAll = (tax: ImportLine['tax']) => setLines((ls) => ls.map((l) => ({ ...l, tax })));

  const submitNewCat = () => {
    if (!catModal) return;
    const name = catName.trim();
    if (!name) return;
    const { i, type } = catModal;
    start(async () => {
      const opt = await addOptionCategory(type === 'income' ? 'incomeCategory' : 'expenseCategory', name);
      if (opt) {
        const add = (p: Opt[]) => (p.some((c) => c.value === opt.value) ? p : [...p, opt]);
        if (type === 'income') setIncCats(add);
        else setExpCats(add);
        setLine(i, { category: opt.value });
      }
      setCatModal(null);
      setCatName('');
    });
  };

  const submitNewClient = () => {
    if (!clientModal) return;
    const i = clientModal.i;
    start(async () => {
      const c = await quickAddClient(agency, contact);
      if (c) {
        setClients((p) => (p.some((x) => x.id === c.id) ? p : [...p, c]));
        setLine(i, { clientId: c.id });
      }
      setClientModal(null);
      setAgency('');
      setContact('');
    });
  };

  const onCatChange = (i: number, type: string, value: string) => {
    if (value === '__new__') { setCatName(''); setCatModal({ i, type }); return; }
    setLine(i, { category: value });
  };
  const onClientChange = (i: number, value: string) => {
    if (value === '__new__') { setAgency(''); setContact(''); setClientModal({ i }); return; }
    setLine(i, { clientId: value || null });
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      {/* Account + statement meta */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Account type</span>
            <select value={acctType} onChange={(e) => setAcctType(e.target.value)} className={`${mini} w-full`}>
              {STATEMENT_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{STATEMENT_ACCOUNT_TYPE_LABELS[t]}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Account name</span>
            <input value={acctLabel} onChange={(e) => setAcctLabel(e.target.value)} className={`${mini} w-full`} placeholder="Scotiabank chequing" />
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Currency</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${mini} w-full`}>
              {currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={`${mini} w-full`} placeholder="e.g. Visa ••1234" />
          </label>
        </div>
      </div>

      {/* Review table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold">Review &amp; edit</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">GST/QST:</span>
              <button onClick={() => applyTaxAll('both')} className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50">All GST+QST</button>
              <button onClick={() => applyTaxAll('gst')} className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50">All GST</button>
              <button onClick={() => applyTaxAll('none')} className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50">Clear</button>
            </div>
            <span className="text-xs text-slate-400">{nExp} exp · {nInc} inc{nTrf ? ` · ${nTrf} transfer` : ''} · {total.toLocaleString('en-US', { style: 'currency', currency: currencies.some((c) => c.value === currency) ? currency : 'CAD' })}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-slate-50 text-center text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2.5 py-3">
                  <input type="checkbox" checked={included.length > 0 && included.length === lines.filter((l) => Number(l.amount) > 0).length}
                    onChange={(e) => { const on = e.target.checked; setLines((ls) => ls.map((l) => ({ ...l, include: on }))); }} className="rounded border-slate-300" />
                </th>
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
              {order.map(({ l, i }) => (
                <tr key={i} className={`${l.include ? '' : 'opacity-50'} hover:bg-slate-50`}>
                  <td className="px-2.5 py-2"><input type="checkbox" checked={l.include} onChange={(e) => setLine(i, { include: e.target.checked })} className="rounded border-slate-300" /></td>
                  <td className="px-2.5 py-2"><input type="date" value={l.date} onChange={(e) => setLine(i, { date: e.target.value })} className={`${mini} w-36`} /></td>
                  <td className="px-2.5 py-2">
                    <select value={l.type} onChange={(e) => onTypeChange(i, e.target.value)} className={`${mini} w-32 ${l.type === 'income' ? 'text-emerald-700' : l.type === 'transfer' ? 'text-indigo-700' : 'text-rose-700'}`}>
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </td>
                  <td className="px-2.5 py-2"><input value={l.title} onChange={(e) => setLine(i, { title: e.target.value })} className={`${mini} w-full min-w-[160px]`} /></td>
                  <td className="px-2.5 py-2">
                    <select value={l.category} onChange={(e) => onCatChange(i, l.type, e.target.value)} className={`${mini} w-40`}>
                      {!(l.type === 'income' ? incCats : expCats).some((c) => c.value === l.category) && l.category && <option value={l.category}>{l.category}</option>}
                      {(l.type === 'income' ? sortedInc : sortedExp).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      <option value="__new__">+ New category…</option>
                    </select>
                  </td>
                  <td className="px-2.5 py-2">
                    {l.type === 'income' ? (
                      <select value={l.clientId ?? ''} onChange={(e) => onClientChange(i, e.target.value)} className={`${mini} w-40 ${l.clientId ? 'text-slate-800' : 'text-slate-500'}`} title="Assign this income to a client">
                        <option value="">— unassigned —</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        <option value="__new__">+ Quick-add client…</option>
                      </select>
                    ) : (
                      <span className="pl-2 text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    {l.type === 'transfer' ? (
                      <span className="pl-2 text-slate-300" title="Transfers carry no GST/QST">—</span>
                    ) : (
                      <select value={l.tax} onChange={(e) => setLine(i, { tax: e.target.value as ImportLine['tax'] })} className={`${mini} w-32`} title={l.type === 'income' ? 'GST/QST collected' : 'GST/QST paid'}>
                        <option value="both">GST + QST</option>
                        <option value="gst">GST only</option>
                        <option value="none">No tax</option>
                      </select>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-right"><input type="number" min="0" step="any" value={l.amount} onChange={(e) => setLine(i, { amount: Number(e.target.value) || 0 })} className={`${mini} w-32 text-right tabular-nums`} /></td>
                  <td className="px-2.5 py-2"><input value={l.note ?? ''} onChange={(e) => setLine(i, { note: e.target.value })} placeholder="Optional" className={`${mini} w-full min-w-[140px]`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={remove} disabled={pendingTx} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-rose-600 disabled:opacity-50">
            <Trash2 size={15} /> Discard
          </button>
          {savedAt && <span className="text-xs text-emerald-600">Saved {savedAt}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={pendingTx} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Save size={15} /> Save for later
          </button>
          <button onClick={commit} disabled={pendingTx || included.length === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50">
            {pendingTx ? 'Working…' : `Import ${included.length} line${included.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>

      {/* New-category modal */}
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

      {/* Quick-add client modal */}
      {clientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !pendingTx && setClientModal(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">Quick-add client</h3>
            <p className="mt-0.5 text-xs text-slate-400">Fill either or both — agency (business) and/or contact name.</p>
            <label className="mt-3 block"><span className="mb-1 block text-xs font-medium text-slate-600">Agency / business name</span>
              <input autoFocus value={agency} onChange={(e) => setAgency(e.target.value)} className={`${mini} w-full`} placeholder="Acme Media" />
            </label>
            <label className="mt-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Contact name</span>
              <input value={contact} onChange={(e) => setContact(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitNewClient(); if (e.key === 'Escape') setClientModal(null); }} className={`${mini} w-full`} placeholder="Jane Doe" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setClientModal(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={submitNewClient} disabled={pendingTx || (!agency.trim() && !contact.trim())} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"><UserPlus size={14} /> Add client</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDiscard}
        title="Discard this pending import?"
        message="The parsed lines and the saved file will be deleted."
        confirmLabel="Discard"
        danger
        pending={pendingTx}
        onConfirm={doDiscard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
