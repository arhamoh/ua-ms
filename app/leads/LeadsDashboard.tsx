'use client';

import { useMemo, useRef, useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronDown, Send, PlayCircle, ExternalLink, CheckCircle2 } from 'lucide-react';
import { searchLeads, setLeadStatus, convertLead, setupAndEnroll, runOutreachNow } from './actions';

type SegmentDef = {
  key: string;
  label: string;
  targetTitles: string[];
  industries: string[];
  employeeRange: { min: number; max: number };
  locations: string[];
};
type Lead = {
  id: string;
  name: string;
  title: string | null;
  company: string;
  email: string | null;
  emailStatus: string;
  linkedinUrl: string | null;
  segment: string | null;
  score: number;
  status: string;
  convertedClientId: string | null;
};
type Props = {
  stats: { total: number; withEmail: number; byStatus: Record<string, number>; bySegment: Record<string, number> };
  leads: Lead[];
  segmentDefs: SegmentDef[];
  apolloReady: boolean;
};

const TITLE_OPTS = ['Founder', 'Co-Founder', 'CEO', 'CTO', 'COO', 'Owner', 'President', 'Managing Director', 'Head of Marketing', 'Marketing Director', 'CMO', 'Head of Product', 'Ecommerce Manager', 'Head of Ecommerce', 'Creative Director', 'General Manager'];
const INDUSTRY_OPTS = ['Software', 'Information Technology & Services', 'Internet', 'Computer Software', 'Marketing & Advertising', 'Design', 'Retail', 'Consumer Goods', 'Apparel & Fashion', 'Cosmetics', 'Health, Wellness & Fitness', 'Financial Services', 'Real Estate', 'Construction', 'Hospitality', 'E-Learning', 'Food & Beverages'];
const LOCATION_OPTS = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Ireland', 'New Zealand', 'Germany', 'France', 'Netherlands', 'Spain', 'United Arab Emirates', 'Singapore', 'India'];
const SIZE_OPTS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000];

function scoreClasses(s: number) {
  if (s >= 70) return 'bg-emerald-50 text-emerald-700';
  if (s >= 45) return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-500';
}
const STATUS_CLASSES: Record<string, string> = {
  new: 'bg-slate-100 text-slate-500',
  scored: 'bg-slate-100 text-slate-600',
  queued: 'bg-violet-50 text-violet-700',
  contacted: 'bg-sky-50 text-sky-700',
  replied: 'bg-emerald-50 text-emerald-700',
  won: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-rose-50 text-rose-700',
  unqualified: 'bg-rose-50 text-rose-700',
};

function MultiSelect({ options, selected, onChange, placeholder = 'Any' }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const merged = useMemo(() => Array.from(new Set([...options, ...selected])), [options, selected]);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const label = selected.length === 0 ? placeholder : selected.length <= 2 ? selected.join(', ') : `${selected.length} selected`;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {merged.map((o) => {
            const on = selected.includes(o);
            return (
              <label key={o} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                {o}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LeadsDashboard({ stats, leads, segmentDefs, apolloReady }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const first = segmentDefs[0];

  const [segKey, setSegKey] = useState(first?.key ?? '');
  const [titles, setTitles] = useState<string[]>(first?.targetTitles ?? []);
  const [industries, setIndustries] = useState<string[]>(first?.industries ?? []);
  const [locations, setLocations] = useState<string[]>(first?.locations ?? []);
  const [empMin, setEmpMin] = useState<number>(first?.employeeRange.min ?? 1);
  const [empMax, setEmpMax] = useState<number>(first?.employeeRange.max ?? 100);
  const [limit, setLimit] = useState(10);
  const [msg, setMsg] = useState('');

  const [segFilter, setSegFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  function applySegment(key: string) {
    setSegKey(key);
    const s = segmentDefs.find((x) => x.key === key);
    if (!s) return;
    setTitles(s.targetTitles);
    setIndustries(s.industries);
    setLocations(s.locations);
    setEmpMin(s.employeeRange.min);
    setEmpMax(s.employeeRange.max);
  }

  const visible = useMemo(
    () => leads.filter((l) => (!segFilter || l.segment === segFilter) && (!statusFilter || l.status === statusFilter)),
    [leads, segFilter, statusFilter],
  );

  const minOpts = useMemo(() => Array.from(new Set([...SIZE_OPTS, empMin])).sort((a, b) => a - b), [empMin]);
  const maxOpts = useMemo(() => Array.from(new Set([...SIZE_OPTS, empMax])).sort((a, b) => a - b), [empMax]);

  function doSearch() {
    setMsg('Searching Apollo… (~10–20s)');
    startTransition(async () => {
      const r = await searchLeads({ segment: segKey, titles, industries, locations, employeeMin: empMin, employeeMax: empMax, limit });
      setMsg(r.ok ? `Added ${r.created} new lead(s) to "${r.segment}" (${r.skipped} already had).` : `⚠️ ${r.error}`);
      router.refresh();
    });
  }
  function act(fn: () => Promise<unknown>, note?: string) {
    startTransition(async () => {
      await fn();
      if (note) setMsg(note);
      router.refresh();
    });
  }

  const cards = [
    ['Total leads', stats.total],
    ['With email', stats.withEmail],
    ['Contacted', stats.byStatus.contacted ?? 0],
    ['Replied', stats.byStatus.replied ?? 0],
    ['Won', stats.byStatus.won ?? 0],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">Source, score, and reach out to new prospects.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => act(setupAndEnroll, 'Sequences set up and leads enrolled.')}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <PlayCircle size={16} /> Set up sequences
          </button>
          <button
            onClick={() => act(runOutreachNow, 'Processed due outreach touches.')}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
          >
            <Send size={16} /> Run outreach
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(([label, n]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-900">{n}</div>
            <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Find leads */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Search size={16} className="text-brand" /> Find leads
        </h2>
        {!apolloReady && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            APOLLO_API_KEY isn’t set — searches return mock data until it’s configured.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Save to niche
            <select value={segKey} onChange={(e) => applySegment(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              {segmentDefs.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Titles (role)
            <MultiSelect options={TITLE_OPTS} selected={titles} onChange={setTitles} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Industries (niche)
            <MultiSelect options={INDUSTRY_OPTS} selected={industries} onChange={setIndustries} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Locations (area)
            <MultiSelect options={LOCATION_OPTS} selected={locations} onChange={setLocations} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Company size
            <span className="flex items-center gap-1">
              <select value={empMin} onChange={(e) => setEmpMin(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                {minOpts.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-slate-400">–</span>
              <select value={empMax} onChange={(e) => setEmpMax(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                {maxOpts.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </span>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            How many
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option value={10}>10 leads</option>
              <option value={25}>25 leads</option>
              <option value={50}>50 leads</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={doSearch} disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-50">
            <Search size={15} /> Search Apollo
          </button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
        </div>
      </section>

      {/* Leads table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <FilterChip active={!segFilter} onClick={() => setSegFilter('')}>All niches</FilterChip>
          {segmentDefs.map((s) => (
            <FilterChip key={s.key} active={segFilter === s.key} onClick={() => setSegFilter(s.key)}>
              {s.key} {stats.bySegment[s.key] ? `· ${stats.bySegment[s.key]}` : ''}
            </FilterChip>
          ))}
          <span className="mx-1 h-4 w-px bg-slate-200" />
          {['', 'scored', 'queued', 'contacted', 'replied', 'won'].map((st) => (
            <FilterChip key={st || 'any'} active={statusFilter === st} onClick={() => setStatusFilter(st)}>
              {st || 'Any status'}
            </FilterChip>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No leads yet — run a search above.</td></tr>
              )}
              {visible.map((l) => (
                <tr key={l.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <span className={`inline-block min-w-[2.25rem] rounded-md px-2 py-0.5 text-center text-xs font-bold ${scoreClasses(l.score)}`}>{l.score}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 font-medium text-slate-800">
                      {l.name}
                      {l.linkedinUrl && <a href={l.linkedinUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-brand"><ExternalLink size={13} /></a>}
                    </div>
                    <div className="text-xs text-slate-400">{l.email ?? 'no email'}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{l.title ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-slate-700">{l.company}</div>
                    <div className="text-[11px] text-slate-400">{l.segment ?? ''}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[l.status] ?? 'bg-slate-100 text-slate-500'}`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {l.convertedClientId ? (
                      <Link href={`/clients/${l.convertedClientId}`} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                        <CheckCircle2 size={13} /> Client
                      </Link>
                    ) : (
                      <div className="inline-flex gap-1">
                        <button onClick={() => act(() => setLeadStatus(l.id, 'replied'))} disabled={pending} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:border-sky-300 hover:text-sky-700 disabled:opacity-50">replied</button>
                        <button onClick={() => act(() => convertLead(l.id), 'Lead converted to client.')} disabled={pending} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50">won → client</button>
                        <button onClick={() => act(() => setLeadStatus(l.id, 'lost'))} disabled={pending} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:border-rose-300 hover:text-rose-700 disabled:opacity-50">lost</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {children}
    </button>
  );
}
