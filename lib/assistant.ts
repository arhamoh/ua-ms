import { prisma } from '@/lib/prisma';
import { getRatesToCad, toCad } from '@/lib/fx';

// Builds a compact, live snapshot of the platform's data (all CAD) to ground
// the analytics assistant. Kept bounded so it fits comfortably in context.
export async function buildAssistantContext(): Promise<string> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [rates, clients, projects, monthPayments, monthExpenses, monthSalaryPays, monthComms, users] =
    await Promise.all([
      getRatesToCad(),
      prisma.client.findMany({
        take: 40,
        orderBy: { createdAt: 'desc' },
        include: { projects: true, payments: true },
      }),
      prisma.project.findMany({ select: { status: true } }),
      prisma.payment.findMany({ where: { paidAt: { gte: start, lt: end } } }),
      prisma.expense.findMany({ where: { date: { gte: start, lt: end } } }),
      prisma.salaryPayment.findMany({ where: { paidAt: { gte: start, lt: end } } }),
      prisma.commissionPayout.findMany({ where: { paidAt: { gte: start, lt: end } } }),
      prisma.user.findMany({ select: { name: true, roles: true } }),
    ]);

  const cad = (a: number | null, c: string | null) => toCad(a ?? 0, c, rates);

  const clientRows = clients.map((cl) => {
    const billed = cl.projects.reduce((s, p) => s + cad(p.budgetAmount, p.budgetCurrency), 0);
    const paid = cl.payments.reduce((s, p) => s + (p.amountCad ?? cad(p.amount, p.currency)), 0);
    return { client: cl.name, projects: cl.projects.length, billedCad: Math.round(billed), paidCad: Math.round(paid), outstandingCad: Math.round(billed - paid) };
  });

  const projectsByStatus: Record<string, number> = {};
  projects.forEach((p) => (projectsByStatus[p.status] = (projectsByStatus[p.status] ?? 0) + 1));

  const income = monthPayments.reduce((s, p) => s + (p.amountCad ?? cad(p.amount, p.currency)), 0);
  const expenses =
    monthExpenses.reduce((s, e) => s + (e.amountCad ?? cad(e.amount, e.currency)), 0) +
    monthSalaryPays.reduce((s, p) => s + (p.amountCad ?? cad(p.amount, p.currency)), 0) +
    monthComms.reduce((s, p) => s + p.amount, 0);

  const monthLabel = start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const snapshot = {
    currency: 'CAD',
    totals: {
      clients: clients.length,
      projects: projects.length,
      totalBilledCad: Math.round(clientRows.reduce((s, r) => s + r.billedCad, 0)),
      totalPaidCad: Math.round(clientRows.reduce((s, r) => s + r.paidCad, 0)),
      totalOutstandingCad: Math.round(clientRows.reduce((s, r) => s + r.outstandingCad, 0)),
    },
    projectsByStatus,
    thisMonth: { label: monthLabel, incomeCad: Math.round(income), expensesCad: Math.round(expenses), netCad: Math.round(income - expenses) },
    clients: clientRows,
    team: users.map((u) => ({ name: u.name, roles: u.roles })),
  };

  return JSON.stringify(snapshot);
}

// ─── Chat history + usage (for the assistant page) ───────────────────────────

export type AssistantMsg = { role: 'user' | 'assistant'; content: string };

// A user's own saved chat history (most recent `limit`, returned oldest-first).
export async function getAssistantHistory(userId: string, limit = 100): Promise<AssistantMsg[]> {
  const rows = await prisma.assistantMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { role: true, content: true },
  });
  return rows
    .reverse()
    .map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content }));
}

export type AssistantUsage = {
  totalCostUsd: number;
  totalTokens: number;
  messageCount: number;
  perUser: { name: string; messages: number; tokens: number; costUsd: number }[];
  remainingUsd: number | null;
};

// Platform-wide assistant usage, for the super-admin credits view.
export async function getAssistantUsage(): Promise<AssistantUsage> {
  const [agg, grouped] = await Promise.all([
    prisma.assistantMessage.aggregate({
      _sum: { costUsd: true, promptTokens: true, completionTokens: true },
      _count: true,
    }),
    prisma.assistantMessage.groupBy({
      by: ['userId'],
      _sum: { costUsd: true, promptTokens: true, completionTokens: true },
      _count: true,
    }),
  ]);

  const userIds = grouped.map((g) => g.userId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  const perUser = grouped
    .map((g) => ({
      name: nameOf.get(g.userId) ?? 'Unknown',
      messages: g._count,
      tokens: (g._sum.promptTokens ?? 0) + (g._sum.completionTokens ?? 0),
      costUsd: g._sum.costUsd ?? 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd || b.tokens - a.tokens);

  // Best-effort: OpenRouter remaining credit (limit - usage), if the key allows it.
  let remainingUsd: number | null = null;
  const key = process.env.OPENROUTER_API_KEY;
  if (key) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${key}` } });
      if (res.ok) {
        const data: any = await res.json();
        const limit = data?.data?.limit;
        const usage = data?.data?.usage;
        if (typeof limit === 'number') remainingUsd = Math.max(0, limit - (usage ?? 0));
      }
    } catch {
      /* ignore — remaining stays null */
    }
  }

  return {
    totalCostUsd: agg._sum.costUsd ?? 0,
    totalTokens: (agg._sum.promptTokens ?? 0) + (agg._sum.completionTokens ?? 0),
    messageCount: agg._count,
    perUser,
    remainingUsd,
  };
}
