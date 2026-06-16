import { Coins, Trash2, Cpu, MessagesSquare, Wallet } from 'lucide-react';
import AssistantChat from '@/components/AssistantChat';
import AssistantIcon from '@/components/AssistantIcon';
import { getSession } from '@/lib/auth';
import { getAssistantHistory, getAssistantUsage } from '@/lib/assistant';
import { clearAssistantHistory } from '@/app/actions';

export const dynamic = 'force-dynamic';

const usd = (n: number) =>
  n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n > 0 && n < 0.01 ? 4 : 3)}`;

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon} {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

export default async function AssistantPage() {
  const session = await getSession();
  const isSuperAdmin = !!session?.roles?.includes('SUPER_ADMIN');
  const history = session ? await getAssistantHistory(session.id) : [];
  const usage = isSuperAdmin ? await getAssistantUsage() : null;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <AssistantIcon size={24} className="text-brand" /> Analytics Assistant
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ask about clients, projects, payments, commissions, and this month’s finances.
          </p>
        </div>
        {history.length > 0 && (
          <form action={clearAssistantHistory}>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-rose-600">
              <Trash2 size={13} /> Clear history
            </button>
          </form>
        )}
      </div>

      {/* Credits — super admin only */}
      {usage && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Coins size={13} /> Assistant credits
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Wallet size={13} />} label="Credit left" value={usage.remainingUsd != null ? usd(usage.remainingUsd) : '—'} />
            <Stat icon={<Coins size={13} />} label="Spent" value={usd(usage.totalCostUsd)} />
            <Stat icon={<Cpu size={13} />} label="Tokens" value={usage.totalTokens.toLocaleString()} />
            <Stat icon={<MessagesSquare size={13} />} label="Messages" value={usage.messageCount.toLocaleString()} />
          </div>
          {usage.perUser.length > 0 && (
            <details className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-slate-500">Usage by person</summary>
              <table className="mt-2 w-full text-xs">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="py-1 font-medium">Person</th>
                    <th className="py-1 text-right font-medium">Messages</th>
                    <th className="py-1 text-right font-medium">Tokens</th>
                    <th className="py-1 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usage.perUser.map((u) => (
                    <tr key={u.name}>
                      <td className="py-1 text-slate-700">{u.name}</td>
                      <td className="py-1 text-right tabular-nums text-slate-600">{u.messages}</td>
                      <td className="py-1 text-right tabular-nums text-slate-600">{u.tokens.toLocaleString()}</td>
                      <td className="py-1 text-right tabular-nums text-slate-600">{usd(u.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}

      {/* Chat */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <AssistantChat className="min-h-0 flex-1" initialMessages={history} />
      </div>
    </div>
  );
}
