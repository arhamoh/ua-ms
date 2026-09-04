import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { hasApolloKey } from '@/lib/leadgen/pipeline';
import { twitterApiConfigured } from '@/lib/leadgen/xpipeline';
import { Search, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

function XLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default async function LeadsHubPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN')) redirect('/dashboard');

  const [leadTotal, leadContacted, leadWon, tweetTotal, tweetNew] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: 'contacted' } }),
    prisma.lead.count({ where: { status: 'won' } }),
    prisma.tweetLead.count({ where: { status: { not: 'ignored' } } }),
    prisma.tweetLead.count({ where: { status: 'new' } }),
  ]);

  const apolloReady = hasApolloKey();
  const xReady = twitterApiConfigured();

  const cards = [
    {
      href: '/leads/apollo',
      icon: <Search size={20} />,
      name: 'Apollo — outbound leads',
      description: 'Source decision-makers by title, industry, size & location, then score and run outreach sequences.',
      stats: [
        { label: 'Leads', value: leadTotal },
        { label: 'Contacted', value: leadContacted },
        { label: 'Won', value: leadWon },
      ],
      ready: apolloReady,
      readyHint: 'Add APOLLO_API_KEY in Settings → Integrations.',
      accent: 'text-brand',
    },
    {
      href: '/leads/x',
      icon: <XLogo />,
      name: 'X — inbound signals',
      description: 'Listen for buying-intent tweets, learn which are worth it, and reply fast with an AI-drafted message.',
      stats: [
        { label: 'Signals', value: tweetTotal },
        { label: 'New', value: tweetNew },
      ],
      ready: xReady,
      readyHint: 'Add TWITTERAPI_IO_KEY in Settings → Integrations.',
      accent: 'text-ink',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500">Two ways to fill the pipeline — reach out, or listen in.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className={`inline-grid h-10 w-10 place-items-center rounded-xl bg-slate-100 ${c.accent}`}>{c.icon}</span>
              <ArrowRight size={18} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand" />
            </div>
            <h2 className="mt-3 text-base font-semibold text-slate-900">{c.name}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{c.description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {c.stats.map((s) => (
                <span key={s.label} className="inline-flex items-baseline gap-1 rounded-lg bg-slate-50 px-2.5 py-1">
                  <span className="text-sm font-semibold text-slate-800">{s.value}</span>
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">{s.label}</span>
                </span>
              ))}
            </div>

            {!c.ready && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">Not configured — {c.readyHint}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
