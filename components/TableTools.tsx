'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

/**
 * Enhances an existing server-rendered <table> with a top-right search box and
 * click-to-sort (ascending/descending) column headers — without changing how
 * the table's cells are rendered. Wrap it around a block that contains one
 * <table>:
 *
 *   <TableTools>
 *     <div className="overflow-x-auto"><table>…</table></div>
 *   </TableTools>
 *
 * Columns whose header is empty or labelled "Actions" (or carry data-nosort)
 * are not sortable. Rows are filtered by their visible text; sorting is numeric
 * / date aware, falling back to natural string compare.
 */
export default function TableTools({
  children,
  searchPlaceholder = 'Search…',
  className = '',
}: {
  children: React.ReactNode;
  searchPlaceholder?: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const caretsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const sortRef = useRef<{ col: number; dir: 1 | -1 } | null>(null);
  const [q, setQ] = useState('');
  const [count, setCount] = useState<{ shown: number; total: number } | null>(null);

  const firstTable = () => wrapRef.current?.querySelector('table') ?? null;

  // Wire up sortable headers once the table is in the DOM.
  useEffect(() => {
    const table = firstTable();
    const headRow = table?.tHead?.rows?.[0];
    if (!table || !headRow) return;
    const heads = Array.from(headRow.cells);
    const cleanups: (() => void)[] = [];
    caretsRef.current = [];

    heads.forEach((th, idx) => {
      const label = (th.textContent ?? '').trim().toLowerCase();
      const sortable = th.dataset.nosort === undefined && label !== '' && label !== 'actions';
      if (!sortable) { caretsRef.current[idx] = null; return; }
      th.style.cursor = 'pointer';
      th.classList.add('select-none');
      th.title = 'Click to sort';
      const caret = document.createElement('span');
      caret.setAttribute('aria-hidden', 'true');
      caret.className = 'ml-1 inline-block text-[10px] text-slate-300 align-middle';
      caret.textContent = '↕';
      th.appendChild(caret);
      caretsRef.current[idx] = caret;
      const onClick = () => sortBy(idx);
      th.addEventListener('click', onClick);
      cleanups.push(() => { th.removeEventListener('click', onClick); caret.remove(); });
    });

    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter rows on search.
  useEffect(() => {
    const body = firstTable()?.tBodies?.[0];
    if (!body) return;
    const term = q.trim().toLowerCase();
    let shown = 0;
    const rows = Array.from(body.rows);
    for (const tr of rows) {
      const match = !term || (tr.textContent ?? '').toLowerCase().includes(term);
      tr.hidden = !match;
      if (match) shown++;
    }
    setCount({ shown, total: rows.length });
  }, [q]);

  const parse = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const numeric = t.replace(/[^0-9.\-]/g, '');
    if (numeric && /\d/.test(numeric) && !Number.isNaN(Number(numeric)) && /^[\s$€£,.\d%+\-]+$/.test(t)) return Number(numeric);
    const d = Date.parse(t);
    if (!Number.isNaN(d) && /\d/.test(t)) return d;
    return null;
  };

  const sortBy = (col: number) => {
    const table = firstTable();
    const body = table?.tBodies?.[0];
    if (!body) return;
    const cur = sortRef.current;
    const dir: 1 | -1 = cur && cur.col === col ? (cur.dir === 1 ? -1 : 1) : 1;
    sortRef.current = { col, dir };

    const rows = Array.from(body.rows);
    rows.sort((a, b) => {
      const av = (a.cells[col]?.textContent ?? '').trim();
      const bv = (b.cells[col]?.textContent ?? '').trim();
      const an = parse(av);
      const bn = parse(bv);
      const cmp = an != null && bn != null ? an - bn : av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
      return cmp * dir;
    });
    for (const r of rows) body.appendChild(r);

    caretsRef.current.forEach((c, i) => {
      if (!c) return;
      c.textContent = i === col ? (dir === 1 ? '▲' : '▼') : '↕';
      c.className = `ml-1 inline-block text-[10px] align-middle ${i === col ? 'text-brand' : 'text-slate-300'}`;
    });
  };

  return (
    <div ref={wrapRef} className={className}>
      <div className="flex items-center justify-end gap-2 px-4 pt-4 pb-2">
        {count && q && <span className="text-xs text-slate-400">{count.shown} of {count.total}</span>}
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-48 rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10 sm:w-64"
          />
        </div>
      </div>
      {children}
    </div>
  );
}
