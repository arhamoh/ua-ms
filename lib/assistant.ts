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
