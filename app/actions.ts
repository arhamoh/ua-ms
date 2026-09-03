'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  ROLES,
  CLIENT_SOURCES,
  PROJECT_TYPES,
  BUDGET_TYPES,
  PRIORITIES,
  PAYMENT_METHODS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_APPROVAL_GATED_STATUSES,
  TASK_REVIEW_STATUS,
  isTaskApprover,
  canManageLogins,
  LEAD_TYPES,
  CURRENCIES,
  PAYMENT_METHOD_LABELS,
  FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
  PROJECT_STATUSES,
} from '@/lib/enums';
import { getRatesToCad, toCad } from '@/lib/fx';
import { sendEmail, verifyEmailConnection } from '@/lib/email';
import { invoiceHtml, receiptHtml } from '@/lib/documents';
import { getCompany, computeTax } from '@/lib/company';
import { backOutExpenseTax, backOutTax, collectedFromPayment } from '@/lib/tax';
import { ruleKey } from '@/lib/txnrules';
import { EXPENSE_CATEGORY_LABELS, INCOME_CATEGORY_LABELS } from '@/lib/enums';
import { buildReport, reportToCsv, REPORT_LABELS, type ReportType, type LedgerEntry } from '@/lib/finance-reports';
import { renderReportPdf } from '@/lib/report-pdf';
import { waveConfigured, getWaveBusinesses, getWaveInvoices, mapWaveStatus, testWave } from '@/lib/wave';
import { testTwitterApi } from '@/lib/leadgen/sources/xListener';
import { DEFAULT_OPTIONS } from '@/lib/options';
import type { ImportLine } from '@/lib/statement-parse';
import { getSession } from '@/lib/auth';
import { driveConfigured, uploadToDrive, testDriveConnection } from '@/lib/drive';
import { testOpenRouter } from '@/lib/integrations';
import { setSecret, clearSecret, isManagedSecret } from '@/lib/secrets';
import { NOTIFY_CATEGORIES } from '@/lib/notify-categories';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { randomUUID } from 'crypto';
import { notifyUsers, resolveMentions } from '@/lib/notify';

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? '').toString().trim();
  return s.length ? s : null;
}

// Accept any category value (built-in or a custom one added on the fly),
// normalized to an uppercase key; empty → OTHER.
function normCat(v: string | null | undefined): string {
  const s = (v ?? '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return s || 'OTHER';
}

// ─── Team members ────────────────────────────────────────────────────────────

export async function createTeamMember(formData: FormData) {
  const name = str(formData.get('name'));
  const email = str(formData.get('email'));
  const roles = formData
    .getAll('roles')
    .map((r) => r.toString())
    .filter((r) => ROLES.includes(r)) as any[];

  if (!name || !email) {
    throw new Error('Name and email are required.');
  }

  await prisma.user.create({
    data: { name, email, roles },
  });

  revalidatePath('/team');
  revalidatePath('/onboard');
  redirect('/team');
}

// ─── Client + Project onboarding ─────────────────────────────────────────────

// Builds the nested Project create payload from form fields (shared by
// onboarding and "add project to existing client").
function buildProjectData(formData: FormData) {
  const projectName = str(formData.get('projectName'));
  if (!projectName) throw new Error('Project name is required.');

  const rawType = str(formData.get('projectType'));
  const projectType = rawType || 'DESIGN';

  const rawBudgetType = str(formData.get('budgetType'));
  const budgetType = BUDGET_TYPES.includes(rawBudgetType ?? '') ? (rawBudgetType as any) : null;

  const rawPriority = str(formData.get('priority'));
  const priority = PRIORITIES.includes(rawPriority ?? '') ? (rawPriority as any) : 'MEDIUM';

  const budgetRaw = str(formData.get('budgetAmount'));
  const budgetAmount = budgetRaw ? Number(budgetRaw) : null;

  const startRaw = str(formData.get('startDate'));
  const deadlineRaw = str(formData.get('deadline'));

  const pmIds = formData.getAll('pmIds').map((v) => v.toString());
  const devIds = formData.getAll('devIds').map((v) => v.toString());
  const designerIds = formData.getAll('designerIds').map((v) => v.toString());
  const members = [
    ...pmIds.map((userId) => ({ userId, role: 'PROJECT_MANAGER' as any })),
    ...devIds.map((userId) => ({ userId, role: 'DEVELOPER' as any })),
    ...designerIds.map((userId) => ({ userId, role: 'DESIGNER' as any })),
  ];

  return {
    name: projectName,
    type: projectType as any,
    description: str(formData.get('description')),
    targetAudience: str(formData.get('targetAudience')),
    referenceLinks: str(formData.get('referenceLinks')),
    budgetAmount: budgetAmount !== null && !Number.isNaN(budgetAmount) ? budgetAmount : null,
    budgetCurrency: str(formData.get('budgetCurrency')) ?? 'USD',
    budgetType,
    startDate: startRaw ? new Date(startRaw) : null,
    deadline: deadlineRaw ? new Date(deadlineRaw) : null,
    priority,
    figmaLink: str(formData.get('figmaLink')),
    fileLinks: str(formData.get('fileLinks')),
    brandAssetsLink: str(formData.get('brandAssetsLink')),
    domainAccess: str(formData.get('domainAccess')),
    internalNotes: str(formData.get('internalNotes')),
    pmCommissionRate: (() => {
      const r = str(formData.get('pmCommissionRate'));
      const n = r ? Number(r) : NaN;
      return !Number.isNaN(n) && n >= 0 ? n : 10;
    })(),
    members: members.length ? { create: members.map((m) => ({ userId: m.userId, role: m.role })) } : undefined,
  };
}

export async function onboardClient(formData: FormData) {
  const clientName = str(formData.get('clientName'));
  if (!clientName) throw new Error('Client name is required.');

  const source = str(formData.get('source')) || null;
  const leadType = str(formData.get('leadType')) || null;
  const salespersonId = str(formData.get('salespersonId'));

  const client = await prisma.client.create({
    data: {
      name: clientName,
      contactName: str(formData.get('contactName')),
      email: str(formData.get('clientEmail')),
      phone: str(formData.get('clientPhone')),
      source,
      sourceOther: str(formData.get('sourceOther')),
      industry: str(formData.get('industry')),
      location: str(formData.get('location')),
      website: str(formData.get('website')),
      socialLinks: str(formData.get('socialLinks')),
      leadType,
      taxRegion: str(formData.get('taxRegion')) || null,
      salespersonId: salespersonId || null,
      projects: { create: buildProjectData(formData) },
    },
    include: { projects: true },
  });

  await autoInvoice(client.id, client.projects[0]);
  await logActivity(`Onboarded client “${clientName}”`);

  revalidatePath('/clients');
  revalidatePath('/');
  redirect(`/projects/${client.projects[0].id}`);
}

// Add a new project to an existing client.
export async function addProjectToClient(formData: FormData) {
  const clientId = str(formData.get('clientId'));
  if (!clientId) throw new Error('Missing client.');

  const project = await prisma.project.create({
    data: { ...buildProjectData(formData), client: { connect: { id: clientId } } },
  });

  await autoInvoice(clientId, project);
  await logActivity(`Added project “${project.name}”`);

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/clients');
  revalidatePath('/');
  redirect(`/projects/${project.id}`);
}

// Generate a draft invoice for a freshly-created project.
async function autoInvoice(
  clientId: string,
  project: { id: string; budgetAmount: number | null; budgetCurrency: string | null; deadline: Date | null },
) {
  await prisma.invoice.create({
    data: {
      clientId,
      projectId: project.id,
      amount: project.budgetAmount ?? 0,
      currency: project.budgetCurrency ?? 'USD',
      dueAt: project.deadline,
    },
  });
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function recordPayment(formData: FormData) {
  const clientId = str(formData.get('clientId'));
  if (!clientId) throw new Error('Missing client.');

  const amountRaw = str(formData.get('amount'));
  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    throw new Error('A valid payment amount is required.');
  }

  const method = str(formData.get('method')) || 'BANK_TRANSFER';

  const paidRaw = str(formData.get('paidAt'));
  const projectId = str(formData.get('projectId'));
  const currency = str(formData.get('currency')) ?? 'USD';
  const invoiceId = str(formData.get('invoiceId'));

  // Capture the CAD value at the moment of recording.
  const rates = await getRatesToCad();
  const fxRate = currency === 'CAD' ? 1 : rates[currency] ?? null;
  const amountCad = toCad(amount, currency, rates);

  await prisma.payment.create({
    data: {
      clientId,
      amount,
      currency,
      amountCad,
      fxRate,
      method,
      paidAt: paidRaw ? new Date(paidRaw) : new Date(),
      note: str(formData.get('note')),
      projectId: projectId || null,
      invoiceId: invoiceId || null,
    },
  });
  await logActivity(`Recorded a payment of ${amount} ${currency}`);

  // Reconcile the linked invoice's status against what's now been paid.
  if (invoiceId) await syncInvoiceStatus(invoiceId);

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/finance');
  if (invoiceId) {
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    redirect(`/invoices/${invoiceId}`);
  }
  redirect(`/clients/${clientId}`);
}

// ─── Tasks (project board) ───────────────────────────────────────────────────

// Records a task change for the acting user, so checkout can auto-fill the day's
// work. Best-effort: never blocks the underlying task action.
async function logTaskActivity(summary: string, opts: { taskId?: string; projectId?: string }) {
  try {
    const s = await getSession();
    await prisma.taskActivity.create({
      data: { userId: s?.id ?? null, summary, taskId: opts.taskId ?? null, projectId: opts.projectId ?? null },
    });
  } catch {
    // ignore logging failures
  }
}

// General activity (non-task) for the checkout "what's been done" summary.
async function logActivity(summary: string) {
  await logTaskActivity(summary, {});
}

// Approval gate: developers/designers can't push a task into a gated
// (client-facing) status. Their attempt is downgraded to "In Review" — i.e.
// submitted for PM/admin approval instead of completed.
// Notify a project's PMs that a task is awaiting their approval.
async function notifyProjectApprovers(projectId: string, taskTitle: string, actorId?: string) {
  const pms = await prisma.projectMember.findMany({
    where: { projectId, role: 'PROJECT_MANAGER' as any },
    select: { userId: true },
  });
  await notifyUsers(
    pms.map((p) => p.userId).filter((id) => id !== actorId),
    {
      type: 'task_approval',
      title: 'Task awaiting your approval',
      body: taskTitle,
      href: `/projects/${projectId}?tab=tasks`,
    },
  );
}

function gateStatus(
  requested: string,
  roles?: string[],
  currentStatus?: string,
): { status: string; gated: boolean } {
  // Only gate a *transition into* a client-facing status — editing a task that
  // is already there (e.g. fixing a typo) must not bounce it back to review.
  if (
    TASK_APPROVAL_GATED_STATUSES.includes(requested) &&
    requested !== currentStatus &&
    !isTaskApprover(roles)
  ) {
    return { status: TASK_REVIEW_STATUS, gated: true };
  }
  return { status: requested, gated: false };
}

export async function createTask(projectId: string, title: string, status: string) {
  const t = title.trim();
  if (!projectId || !t) return;
  const s = await getSession();
  const requested = TASK_STATUSES.includes(status) ? status : 'TODO';
  const { status: target } = gateStatus(requested, s?.roles);
  const created = await prisma.task.create({
    data: {
      projectId,
      title: t,
      status: target as any,
    },
  });
  await logTaskActivity(`Created “${t}”`, { taskId: created.id, projectId });
  revalidatePath(`/projects/${projectId}`);
}

export async function setProjectStatus(projectId: string, status: string) {
  if (!projectId || !PROJECT_STATUSES.includes(status)) return;
  await prisma.project.update({ where: { id: projectId }, data: { status: status as any } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/clients');
  revalidatePath('/');
}

export async function moveTask(taskId: string, status: string, projectId: string) {
  if (!taskId || !TASK_STATUSES.includes(status)) return;
  const s = await getSession();
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true, status: true } });
  const { status: target, gated } = gateStatus(status, s?.roles, task?.status);
  if (task?.status === target) return; // no-op (e.g. gated request already in review)
  await prisma.task.update({ where: { id: taskId }, data: { status: target as any } });
  const title = task?.title ?? 'task';
  if (gated) {
    await logTaskActivity(`Submitted “${title}” for approval`, { taskId, projectId });
    await notifyProjectApprovers(projectId, title, s?.id);
  } else if (target === 'DONE' && task?.status === TASK_REVIEW_STATUS) {
    await logTaskActivity(`Approved “${title}” → Done`, { taskId, projectId });
  } else {
    await logTaskActivity(`Moved “${title}” to ${TASK_STATUS_LABELS[target] ?? target}`, { taskId, projectId });
  }
  revalidatePath(`/projects/${projectId}`);
}

export async function updateTask(
  taskId: string,
  projectId: string,
  data: {
    title: string;
    description: string;
    status: string;
    assigneeId: string;
    priority: string;
    dueDate: string;
    tags: string[];
  },
) {
  const title = data.title.trim();
  if (!taskId || !title) return;
  const s = await getSession();
  const existing = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });
  const requested = TASK_STATUSES.includes(data.status) ? data.status : 'TODO';
  const { status: target, gated } = gateStatus(requested, s?.roles, existing?.status);
  const tagNames = Array.from(
    new Set(data.tags.map((s) => s.trim()).filter(Boolean)),
  ).slice(0, 12);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description: data.description.trim() || null,
      status: target as any,
      priority: PRIORITIES.includes(data.priority) ? (data.priority as any) : 'MEDIUM',
      assigneeId: data.assigneeId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      tags: {
        set: [],
        connectOrCreate: tagNames.map((name) => ({ where: { name }, create: { name } })),
      },
    },
  });
  const statusLabel = TASK_STATUS_LABELS[target] ?? target;
  await logTaskActivity(
    gated ? `Submitted “${title}” for approval` : `Updated “${title}” (${statusLabel})`,
    { taskId, projectId },
  );
  if (gated) await notifyProjectApprovers(projectId, title, s?.id);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteTask(taskId: string, projectId: string) {
  if (!taskId) return;
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/projects/${projectId}`);
}

// ─── Commission payouts ──────────────────────────────────────────────────────

export async function recordCommissionPayout(formData: FormData) {
  const userId = str(formData.get('userId'));
  if (!userId) throw new Error('Missing recipient.');

  const amountRaw = str(formData.get('amount'));
  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    throw new Error('A valid payout amount is required.');
  }

  const paidRaw = str(formData.get('paidAt'));

  await prisma.commissionPayout.create({
    data: {
      userId,
      amount, // CAD
      paidAt: paidRaw ? new Date(paidRaw) : new Date(),
      method: str(formData.get('method')),
      note: str(formData.get('note')),
    },
  });

  revalidatePath('/commissions');
  redirect('/commissions');
}

// ─── Expenses & salaries ─────────────────────────────────────────────────────

export async function addExpense(formData: FormData) {
  const title = str(formData.get('title'));
  if (!title) throw new Error('Expense title is required.');

  const amountRaw = str(formData.get('amount'));
  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    throw new Error('A valid amount is required.');
  }

  const category = str(formData.get('category')) || 'OTHER';
  const currency = str(formData.get('currency')) ?? 'CAD';
  const dateRaw = str(formData.get('date'));

  const rates = await getRatesToCad();
  const fxRate = currency === 'CAD' ? 1 : rates[currency] ?? null;
  const amountCad = toCad(amount, currency, rates);

  // null = company paid directly; otherwise a team member fronted the money.
  const paidById = str(formData.get('paidById')) || null;

  // Input tax credits: back GST/QST out of the total when the purchase included
  // them. Only meaningful for Canadian (CAD) purchases.
  let gst: number | null = null;
  let qst: number | null = null;
  if (str(formData.get('taxIncluded')) && currency === 'CAD') {
    const company = await getCompany();
    const t = backOutExpenseTax(amount, company);
    gst = t.gst;
    qst = t.qst;
  }

  await prisma.expense.create({
    data: {
      title,
      category,
      amount,
      currency,
      amountCad,
      fxRate,
      gst,
      qst,
      date: dateRaw ? new Date(dateRaw) : new Date(),
      note: str(formData.get('note')),
      paidById,
      // A company-paid expense never needs reimbursing.
      reimbursed: paidById ? false : true,
    },
  });
  await logActivity(`Added expense “${title}”`);

  revalidatePath('/finance');
  redirect('/finance?tab=expenses');
}

// Flip an expense's reimbursed flag (when a team member fronted the money).
export async function toggleExpenseReimbursed(id: string) {
  if (!id) return;
  const e = await prisma.expense.findUnique({ where: { id }, select: { reimbursed: true } });
  if (!e) return;
  await prisma.expense.update({
    where: { id },
    data: { reimbursed: !e.reimbursed, reimbursedAt: !e.reimbursed ? new Date() : null },
  });
  revalidatePath('/finance');
}

export async function setSalary(formData: FormData) {
  const userId = str(formData.get('userId'));
  if (!userId) throw new Error('Missing team member.');

  const amountRaw = str(formData.get('amount'));
  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!amountRaw || Number.isNaN(amount) || amount < 0) {
    throw new Error('A valid salary amount is required.');
  }

  const effRaw = str(formData.get('effectiveFrom'));

  await prisma.salary.create({
    data: {
      userId,
      amount,
      currency: str(formData.get('currency')) ?? 'CAD',
      effectiveFrom: effRaw ? new Date(effRaw) : new Date(),
      note: str(formData.get('note')),
    },
  });

  revalidatePath('/finance');
  redirect('/finance?tab=salaries');
}

export async function recordSalaryPayment(formData: FormData) {
  const userId = str(formData.get('userId'));
  if (!userId) throw new Error('Missing team member.');

  const amountRaw = str(formData.get('amount'));
  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    throw new Error('A valid amount is required.');
  }

  const currency = str(formData.get('currency')) ?? 'CAD';
  const paidRaw = str(formData.get('paidAt'));

  const rates = await getRatesToCad();
  const amountCad = toCad(amount, currency, rates);

  await prisma.salaryPayment.create({
    data: {
      userId,
      amount,
      currency,
      amountCad,
      paidAt: paidRaw ? new Date(paidRaw) : new Date(),
      method: str(formData.get('method')),
      note: str(formData.get('note')),
    },
  });

  revalidatePath('/finance');
  redirect('/finance?tab=salaries');
}

// ─── Invoices & receipts ─────────────────────────────────────────────────────

const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'VOID'];

// Recompute an invoice's status from the payments applied to it. Compares total
// paid (CAD) against the invoice total incl. tax (CAD). Leaves a manually VOIDed
// invoice untouched.
async function syncInvoiceStatus(invoiceId: string) {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: { select: { taxRegion: true } }, payments: true },
  });
  if (!inv || inv.status === 'VOID') return;

  const company = await getCompany();
  const tax = computeTax(inv.amount, inv.client.taxRegion, company);
  const rates = await getRatesToCad();
  const totalCad = toCad(tax.total, inv.currency, rates);
  const paidCad = inv.payments.reduce((s, p) => s + (p.amountCad ?? toCad(p.amount, p.currency, rates)), 0);

  let status: string;
  if (paidCad <= 0.01) status = inv.sentAt ? 'SENT' : 'DRAFT';
  else if (paidCad + 0.5 >= totalCad) status = 'PAID';
  else status = 'PARTIAL';

  // Respect a settled PAID invoice: deposits are often LESS than the total
  // (payment-processor/withdrawal fees) and can arrive as several partial
  // transactions, so never auto-downgrade a PAID invoice back to PARTIAL/SENT.
  if (inv.status === 'PAID' && status !== 'PAID') return;

  if (status !== inv.status) {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: status as any } });
  }
}

export async function setInvoiceStatus(formData: FormData) {
  const id = str(formData.get('invoiceId'));
  const status = str(formData.get('status'));
  if (!id || !INVOICE_STATUSES.includes(status ?? '')) return;
  await prisma.invoice.update({ where: { id }, data: { status: status as any } });
  revalidatePath(`/invoices/${id}`);
  revalidatePath('/invoices');
  redirect(`/invoices/${id}`);
}

// Edit an invoice's core fields. Writes to the DB, which every page reads live,
// so the change reflects on the invoice, Finance, and the client profile.
export async function updateInvoice(formData: FormData) {
  const id = str(formData.get('invoiceId'));
  if (!id) return;
  const data: Record<string, any> = {};
  const clientId = str(formData.get('clientId'));
  if (clientId) data.clientId = clientId;
  const amountRaw = str(formData.get('amount'));
  if (amountRaw != null) { const n = Number(amountRaw); if (!Number.isNaN(n) && n >= 0) data.amount = n; }
  const currency = str(formData.get('currency'));
  if (currency && CURRENCIES.includes(currency)) data.currency = currency;
  const status = str(formData.get('status'));
  if (status && INVOICE_STATUSES.includes(status)) data.status = status as any;
  const issued = str(formData.get('issuedAt'));
  if (issued) data.issuedAt = new Date(issued);
  const due = formData.get('dueAt');
  if (due !== null) { const d = str(due); data.dueAt = d ? new Date(d) : null; }
  const notes = formData.get('notes');
  if (notes !== null) data.notes = str(notes);
  if (Object.keys(data).length === 0) redirect(`/invoices/${id}`);

  await prisma.invoice.update({ where: { id }, data });
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
  revalidatePath('/finance');
  revalidatePath('/clients');
  redirect(`/invoices/${id}`);
}

// Attach an already-recorded (e.g. bank-imported) payment to an invoice. Several
// partial deposits can be linked to one invoice; status is recomputed after.
export async function linkPaymentToInvoice(paymentId: string, invoiceId: string) {
  if (!paymentId || !invoiceId) return;
  const [pmt, inv] = await Promise.all([
    prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true } }),
    prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, clientId: true } }),
  ]);
  if (!pmt || !inv) return;
  await prisma.payment.update({ where: { id: paymentId }, data: { invoiceId, clientId: inv.clientId, bankMatchedAt: new Date() } });
  await syncInvoiceStatus(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath('/invoices');
  revalidatePath('/finance');
}

// Detach a payment from its invoice (keeps the payment in the ledger).
export async function unlinkPaymentFromInvoice(paymentId: string) {
  if (!paymentId) return;
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, select: { invoiceId: true } });
  await prisma.payment.update({ where: { id: paymentId }, data: { invoiceId: null, bankMatchedAt: null } });
  if (p?.invoiceId) { await syncInvoiceStatus(p.invoiceId); revalidatePath(`/invoices/${p.invoiceId}`); }
  revalidatePath('/invoices');
  revalidatePath('/finance');
}

// Book the gap between an invoice total and what was actually deposited (the
// payment-processor / withdrawal fee) as an expense, so the ledger balances.
export async function recordInvoiceFee(formData: FormData) {
  const id = str(formData.get('invoiceId'));
  const amount = Number(str(formData.get('amount')) ?? '');
  if (!id || Number.isNaN(amount) || amount <= 0) redirect(`/invoices/${id}`);
  const inv = await prisma.invoice.findUnique({ where: { id }, select: { number: true, externalNumber: true, client: { select: { name: true } } } });
  const label = inv?.externalNumber ? inv.externalNumber : `#${inv?.number ?? ''}`;
  await prisma.expense.create({
    data: {
      title: `Payment processing fee — invoice ${label}`,
      category: 'FEES',
      amount,
      currency: 'CAD',
      amountCad: amount,
      date: new Date(),
      note: `Withdrawal/processing fee for ${inv?.client?.name ?? 'client'}`.slice(0, 300),
    },
  });
  revalidatePath('/finance');
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

export async function emailInvoice(formData: FormData) {
  const id = str(formData.get('invoiceId'));
  if (!id) return;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, project: true },
  });
  if (!invoice) redirect('/invoices');
  if (!invoice!.client.email) {
    redirect(`/invoices/${id}?error=${encodeURIComponent('Client has no email on file.')}`);
  }

  const company = await getCompany();
  const tax = computeTax(invoice!.amount, invoice!.client.taxRegion, company);
  const html = invoiceHtml({
    number: invoice!.number,
    companyName: company.name,
    clientName: invoice!.client.name,
    projectName: invoice!.project?.name,
    currency: invoice!.currency,
    issuedAt: invoice!.issuedAt,
    dueAt: invoice!.dueAt,
    notes: invoice!.notes,
    subtotal: tax.subtotal,
    gst: tax.gst,
    qst: tax.qst,
    total: tax.total,
    gstRate: company.gstRate,
    qstRate: company.qstRate,
  });

  const result = await sendEmail({
    to: invoice!.client.email!,
    subject: `Invoice #${invoice!.number} from UA Agency`,
    html,
  });

  if (!result.ok) {
    redirect(`/invoices/${id}?error=${encodeURIComponent(result.error ?? 'Send failed')}`);
  }

  await prisma.invoice.update({
    where: { id },
    data: { sentAt: new Date(), status: invoice!.status === 'DRAFT' ? 'SENT' : invoice!.status },
  });
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}?sent=1`);
}

export async function emailReceipt(formData: FormData) {
  const id = str(formData.get('paymentId'));
  if (!id) return;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { client: true, project: true },
  });
  if (!payment) redirect('/clients');
  if (!payment!.client.email) {
    redirect(`/receipts/${id}?error=${encodeURIComponent('Client has no email on file.')}`);
  }

  const company = await getCompany();
  const html = receiptHtml({
    companyName: company.name,
    clientName: payment!.client.name,
    projectName: payment!.project?.name,
    amount: payment!.amount,
    currency: payment!.currency,
    paidAt: payment!.paidAt,
    method: PAYMENT_METHOD_LABELS[payment!.method] ?? payment!.method,
    note: payment!.note,
  });

  const result = await sendEmail({
    to: payment!.client.email!,
    subject: `Receipt from UA Agency`,
    html,
  });

  if (!result.ok) {
    redirect(`/receipts/${id}?error=${encodeURIComponent(result.error ?? 'Send failed')}`);
  }
  redirect(`/receipts/${id}?sent=1`);
}

// ─── Project files (Google Drive) ────────────────────────────────────────────

export async function uploadProjectFile(formData: FormData) {
  const projectId = str(formData.get('projectId'));
  if (!projectId) throw new Error('Missing project.');
  const filesTab = `/projects/${projectId}?tab=files`;

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${filesTab}&error=${encodeURIComponent('Choose a file to upload.')}`);
  }
  if (!driveConfigured()) {
    redirect(`${filesTab}&error=${encodeURIComponent('Google Drive is not configured yet.')}`);
  }

  const f = file as File;
  const category = str(formData.get('category')) || 'OTHER';

  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { client: true } });
  if (!project) redirect('/clients');

  const session = await getSession();
  const buffer = Buffer.from(await f.arrayBuffer());

  try {
    const { fileId, webViewLink } = await uploadToDrive({
      clientName: project!.client.name,
      projectName: project!.name,
      categoryLabel: FILE_CATEGORY_LABELS[category] ?? category,
      fileName: f.name,
      mimeType: f.type || 'application/octet-stream',
      buffer,
    });

    await prisma.fileAsset.create({
      data: {
        projectId,
        name: f.name,
        category,
        driveFileId: fileId,
        webViewLink,
        mimeType: f.type || null,
        size: f.size,
        uploadedById: session?.id ?? null,
      },
    });
  } catch (e: any) {
    redirect(`${filesTab}&error=${encodeURIComponent('Upload failed: ' + (e?.message ?? 'unknown error'))}`);
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(filesTab);
}

export async function addFileComment(formData: FormData) {
  const fileId = str(formData.get('fileId'));
  const projectId = str(formData.get('projectId'));
  const body = str(formData.get('body'));
  if (!fileId || !body) return;
  const session = await getSession();
  await prisma.fileComment.create({ data: { fileId, body, authorId: session?.id ?? null } });

  // Notify anyone @mentioned in the comment (excluding the author).
  const mentioned = (await resolveMentions(body)).filter((id) => id !== session?.id);
  await notifyUsers(mentioned, {
    type: 'mention',
    title: `${session?.name ?? 'Someone'} mentioned you`,
    body: body.slice(0, 160),
    href: `/projects/${projectId}?tab=files`,
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=files`);
}

export async function deleteFileAsset(formData: FormData) {
  const fileId = str(formData.get('fileId'));
  const projectId = str(formData.get('projectId'));
  if (!fileId) return;
  // Removes the index entry only; the file stays in the Shared Drive.
  await prisma.fileAsset.delete({ where: { id: fileId } });
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=files`);
}

// ─── Demo data & maintenance ─────────────────────────────────────────────────

// Create an invoice for any project that doesn't have one yet.
export async function backfillInvoices() {
  const projects = await prisma.project.findMany({ where: { invoices: { none: {} } } });
  for (const p of projects) {
    await prisma.invoice.create({
      data: {
        clientId: p.clientId,
        projectId: p.id,
        amount: p.budgetAmount ?? 0,
        currency: p.budgetCurrency ?? 'USD',
        dueAt: p.deadline,
      },
    });
  }
  revalidatePath('/invoices');
  redirect('/settings?done=invoices');
}

export async function clearDemoData() {
  // Remove demo records AND the original Acme seed. Deleting demo clients cascades
  // their projects/tasks/invoices/payments; deleting demo users cascades their
  // memberships/salaries/payments/commissions (Task.assignee is set null).
  await prisma.client.deleteMany({
    where: { OR: [{ name: { startsWith: 'Demo —' } }, { name: 'Acme Inc.' }] },
  });
  await prisma.expense.deleteMany({ where: { title: { startsWith: 'Demo —' } } });
  await prisma.user.deleteMany({
    where: { OR: [{ email: { endsWith: '@uademo.test' } }, { email: 'demo.sales@uaagency.com' }] },
  });
  revalidatePath('/');
  redirect('/settings?done=cleared');
}

export async function seedDemoData() {
  const rates = await getRatesToCad();
  const cadOf = (a: number, c: string) => toCad(a, c, rates);
  const admin = await prisma.user.findFirst({ where: { roles: { has: 'SUPER_ADMIN' as any } } });
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

  // ── Demo team (6 members across roles) — emails on @uademo.test so cleanup is exact ──
  const MEMBERS = [
    { name: 'Aisha Khan', role: 'PROJECT_MANAGER', salary: 2200 },
    { name: 'Daniel Cruz', role: 'PROJECT_MANAGER', salary: 2100 },
    { name: 'Sam Lee', role: 'DEVELOPER', salary: 1800 },
    { name: 'Omar Farooq', role: 'DEVELOPER', salary: 1700 },
    { name: 'Priya Patel', role: 'DESIGNER', salary: 1600 },
    { name: 'Bilal Ahmed', role: 'SALES', salary: 1400 },
  ];
  const team: { id: string; role: string; salary: number }[] = [];
  for (const m of MEMBERS) {
    const email = `${m.name.toLowerCase().replace(/\s+/g, '.')}@uademo.test`;
    const u = await prisma.user.upsert({
      where: { email },
      update: { roles: [m.role] as any },
      create: { email, name: m.name, roles: [m.role] as any },
    });
    team.push({ id: u.id, role: m.role, salary: m.salary });
  }
  const pms = team.filter((t) => t.role === 'PROJECT_MANAGER');
  const developers = team.filter((t) => t.role === 'DEVELOPER');
  const designers = team.filter((t) => t.role === 'DESIGNER');
  const salesperson = team.find((t) => t.role === 'SALES') ?? team[0];
  const assignable = [...team, ...(admin ? [{ id: admin.id }] : [])];

  // ── Clients, each with 2–3 projects (~26 projects total) ──
  const SOURCES = ['UPWORK', 'AGENCY', 'REFERRAL', 'OTHER'];
  const CLIENTS: {
    name: string;
    cur: string;
    lead: string;
    projects: { name: string; type: string; budget: number; status: string }[];
  }[] = [
    { name: 'Brightline', cur: 'USD', lead: 'GENERATED', projects: [
      { name: 'Brightline Website', type: 'DEVELOPMENT', budget: 12000, status: 'ACTIVE' },
      { name: 'Brightline Brand Refresh', type: 'DESIGN', budget: 4500, status: 'COMPLETED' },
    ] },
    { name: 'Nova Foods', cur: 'CAD', lead: 'INVITE', projects: [
      { name: 'Nova Branding', type: 'DESIGN', budget: 4000, status: 'ACTIVE' },
      { name: 'Nova E-commerce', type: 'DEVELOPMENT', budget: 15000, status: 'ONBOARDING' },
      { name: 'Nova Mobile App', type: 'SOFTWARE', budget: 22000, status: 'ACTIVE' },
    ] },
    { name: 'Karachi Tech', cur: 'USD', lead: 'GENERATED', projects: [
      { name: 'KT Mobile App', type: 'SOFTWARE', budget: 8000, status: 'ACTIVE' },
      { name: 'KT Marketing Site', type: 'DEVELOPMENT', budget: 5000, status: 'ON_HOLD' },
    ] },
    { name: 'Maple & Co', cur: 'CAD', lead: 'INVITE', projects: [
      { name: 'Maple Identity', type: 'DESIGN', budget: 3500, status: 'COMPLETED' },
      { name: 'Maple Storefront', type: 'DEVELOPMENT', budget: 9000, status: 'ACTIVE' },
    ] },
    { name: 'Skyline Realty', cur: 'USD', lead: 'GENERATED', projects: [
      { name: 'Skyline Portal', type: 'SOFTWARE', budget: 18000, status: 'ACTIVE' },
      { name: 'Skyline Listings Redesign', type: 'DESIGN', budget: 6000, status: 'ACTIVE' },
    ] },
    { name: 'Greenleaf', cur: 'EUR', lead: 'GENERATED', projects: [
      { name: 'Greenleaf Website', type: 'DEVELOPMENT', budget: 11000, status: 'ACTIVE' },
      { name: 'Greenleaf Packaging', type: 'DESIGN', budget: 5200, status: 'ONBOARDING' },
    ] },
    { name: 'Orbit Labs', cur: 'USD', lead: 'GENERATED', projects: [
      { name: 'Orbit SaaS Dashboard', type: 'SOFTWARE', budget: 26000, status: 'ACTIVE' },
      { name: 'Orbit Docs Site', type: 'DEVELOPMENT', budget: 7000, status: 'COMPLETED' },
    ] },
    { name: 'Lumen Media', cur: 'CAD', lead: 'INVITE', projects: [
      { name: 'Lumen Campaign Site', type: 'DEVELOPMENT', budget: 8500, status: 'ACTIVE' },
      { name: 'Lumen Social Kit', type: 'DESIGN', budget: 3000, status: 'ACTIVE' },
    ] },
    { name: 'Harbor Bank', cur: 'USD', lead: 'GENERATED', projects: [
      { name: 'Harbor Onboarding Flow', type: 'SOFTWARE', budget: 30000, status: 'ACTIVE' },
      { name: 'Harbor Brand Guidelines', type: 'DESIGN', budget: 6500, status: 'COMPLETED' },
    ] },
    { name: 'Pixel Forge', cur: 'USD', lead: 'GENERATED', projects: [
      { name: 'Pixel Forge Studio Site', type: 'DEVELOPMENT', budget: 9500, status: 'ACTIVE' },
      { name: 'Pixel Forge Game UI', type: 'DESIGN', budget: 7800, status: 'ON_HOLD' },
    ] },
    { name: 'Verde Coffee', cur: 'CAD', lead: 'INVITE', projects: [
      { name: 'Verde Online Store', type: 'DEVELOPMENT', budget: 6800, status: 'ACTIVE' },
      { name: 'Verde Rebrand', type: 'DESIGN', budget: 4200, status: 'COMPLETED' },
    ] },
    { name: 'Atlas Logistics', cur: 'USD', lead: 'GENERATED', projects: [
      { name: 'Atlas Tracking Portal', type: 'SOFTWARE', budget: 24000, status: 'ACTIVE' },
      { name: 'Atlas Marketing Site', type: 'DEVELOPMENT', budget: 8000, status: 'ONBOARDING' },
    ] },
  ];

  const TASK_VERBS = ['Design', 'Build', 'Wireframe', 'Implement', 'Test', 'Review', 'Refactor', 'Integrate', 'Document', 'Polish', 'Fix', 'Optimize', 'Deploy', 'Research', 'Set up'];
  const TASK_NOUNS = ['homepage', 'auth flow', 'dashboard', 'API endpoints', 'checkout', 'onboarding', 'settings page', 'navigation', 'database schema', 'landing page', 'email templates', 'reports', 'search', 'profile page', 'payment flow', 'mobile layout', 'analytics', 'notifications', 'file uploads', 'admin panel'];
  const TASK_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
  const PRIOS = ['LOW', 'MEDIUM', 'HIGH'];
  const METHODS = ['BANK_TRANSFER', 'WISE', 'REMITLY', 'PAYONEER', 'PAYPAL'];

  let projIdx = 0;
  for (let ci = 0; ci < CLIENTS.length; ci++) {
    const c = CLIENTS[ci];
    const client = await prisma.client.create({
      data: {
        name: `Demo — ${c.name}`,
        email: `hello@${c.name.toLowerCase().replace(/\s+/g, '')}.com`,
        source: SOURCES[ci % SOURCES.length] as any,
        leadType: c.lead as any,
        salespersonId: salesperson.id,
      },
    });

    for (const p of c.projects) {
      const pm = pms[projIdx % pms.length];
      const dev = developers[projIdx % developers.length];
      const des = designers[projIdx % designers.length];
      const memberRows = [
        { userId: pm.id, role: 'PROJECT_MANAGER' as any },
        ...(dev ? [{ userId: dev.id, role: 'DEVELOPER' as any }] : []),
        ...(des ? [{ userId: des.id, role: 'DESIGNER' as any }] : []),
      ];
      const seenMember = new Set<string>();
      const members = memberRows.filter((m) => {
        const k = `${m.userId}-${m.role}`;
        if (seenMember.has(k)) return false;
        seenMember.add(k);
        return true;
      });

      const project = await prisma.project.create({
        data: {
          clientId: client.id,
          name: p.name,
          type: p.type as any,
          budgetAmount: p.budget,
          budgetCurrency: c.cur,
          budgetType: 'FIXED' as any,
          status: p.status as any,
          priority: PRIOS[projIdx % 3] as any,
          pmCommissionRate: 10,
          members: { create: members },
        },
      });

      // 20 tasks per project, spread across statuses/priorities/assignees
      const tasks = Array.from({ length: 20 }, (_, i) => {
        const a = assignable[(projIdx + i) % assignable.length];
        return {
          projectId: project.id,
          title: `${TASK_VERBS[(projIdx + i) % TASK_VERBS.length]} ${TASK_NOUNS[i % TASK_NOUNS.length]}`,
          status: TASK_STATUSES[i % TASK_STATUSES.length] as any,
          priority: PRIOS[i % 3] as any,
          assigneeId: a?.id ?? null,
        };
      });
      await prisma.task.createMany({ data: tasks });

      await prisma.invoice.create({
        data: { clientId: client.id, projectId: project.id, amount: p.budget, currency: c.cur, status: 'SENT' as any },
      });

      // 1–3 payments (deposit + milestones), dated across the last few months
      const fractions = p.status === 'COMPLETED' ? [0.4, 0.3, 0.3] : projIdx % 2 === 0 ? [0.5, 0.25] : [0.4];
      let fi = 0;
      for (const fr of fractions) {
        const amt = Math.round(p.budget * fr);
        await prisma.payment.create({
          data: {
            clientId: client.id,
            projectId: project.id,
            amount: amt,
            currency: c.cur,
            amountCad: cadOf(amt, c.cur),
            method: METHODS[(projIdx + fi) % METHODS.length],
            paidAt: daysAgo(12 * (projIdx % 9) + fi * 18 + 3),
          },
        });
        fi++;
      }

      projIdx++;
    }
  }

  // ── Expenses (varied categories / currencies / dates) ──
  const EXPENSES = [
    { t: 'Demo — Adobe Creative Cloud', a: 60, c: 'USD', cat: 'SOFTWARE' },
    { t: 'Demo — Figma seats', a: 45, c: 'USD', cat: 'SOFTWARE' },
    { t: 'Demo — Vercel hosting', a: 20, c: 'USD', cat: 'HOSTING' },
    { t: 'Demo — Railway hosting', a: 25, c: 'USD', cat: 'HOSTING' },
    { t: 'Demo — Office rent (Karachi)', a: 60000, c: 'PKR', cat: 'OFFICE' },
    { t: 'Demo — Internet & utilities', a: 12000, c: 'PKR', cat: 'UTILITIES' },
    { t: 'Demo — Google Workspace', a: 36, c: 'USD', cat: 'SUBSCRIPTION' },
    { t: 'Demo — Meta Ads', a: 300, c: 'USD', cat: 'MARKETING' },
    { t: 'Demo — Team lunch', a: 140, c: 'CAD', cat: 'MEALS' },
    { t: 'Demo — Client visit travel', a: 420, c: 'CAD', cat: 'TRAVEL' },
    { t: 'Demo — New monitor', a: 380, c: 'CAD', cat: 'EQUIPMENT' },
    { t: 'Demo — Contractor (icons)', a: 250, c: 'USD', cat: 'CONTRACTOR' },
    { t: 'Demo — Domain renewals', a: 80, c: 'USD', cat: 'SOFTWARE' },
    { t: 'Demo — Bank fees', a: 35, c: 'CAD', cat: 'FEES' },
  ];
  for (let i = 0; i < EXPENSES.length; i++) {
    const e = EXPENSES[i];
    await prisma.expense.create({
      data: { title: e.t, category: e.cat as any, amount: e.a, currency: e.c, amountCad: cadOf(e.a, e.c), date: daysAgo(8 * i + 5) },
    });
  }

  // ── Salaries + salary payments for each team member ──
  for (let i = 0; i < team.length; i++) {
    const m = team[i];
    await prisma.salary.create({ data: { userId: m.id, amount: m.salary, currency: 'CAD', effectiveFrom: daysAgo(180) } });
    for (const mo of [60, 30]) {
      await prisma.salaryPayment.create({
        data: { userId: m.id, amount: m.salary, currency: 'CAD', amountCad: m.salary, paidAt: daysAgo(mo), method: METHODS[i % METHODS.length] },
      });
    }
  }

  // ── Commission payouts (sales + PMs) ──
  const payoutPeople = [salesperson, ...pms];
  for (let i = 0; i < payoutPeople.length; i++) {
    await prisma.commissionPayout.create({
      data: { userId: payoutPeople[i].id, amount: 300 + i * 120, paidAt: daysAgo(20 + i * 15), method: METHODS[i % METHODS.length], note: 'Demo payout' },
    });
  }

  revalidatePath('/');
  redirect('/settings?done=seeded');
}

// ─── Dropdown options ────────────────────────────────────────────────────────

export async function addOption(formData: FormData) {
  const kind = str(formData.get('kind'));
  const label = str(formData.get('label'));
  if (!kind || !label) return;
  const value = (str(formData.get('value')) || label).trim();
  const rateRaw = str(formData.get('rate'));
  const rate = rateRaw && !Number.isNaN(Number(rateRaw)) ? Number(rateRaw) : null;
  const max = await prisma.optionItem.aggregate({ where: { kind }, _max: { order: true } });

  await prisma.optionItem.upsert({
    where: { kind_value: { kind, value } },
    update: { label, rate },
    create: { kind, value, label, rate, order: (max._max.order ?? 0) + 1 },
  });
  revalidatePath('/settings');
  redirect('/settings');
}

export async function deleteOption(formData: FormData) {
  const id = str(formData.get('id'));
  if (!id) return;
  await prisma.optionItem.delete({ where: { id } });
  revalidatePath('/settings');
  redirect('/settings');
}

// Rename an option's display label (keeps its stored value, so existing records
// that reference this category/option stay mapped). Used by the inline editor.
export async function updateOption(id: string, label: string) {
  if (!id) return;
  const l = (label ?? '').trim();
  if (!l) return;
  await prisma.optionItem.update({ where: { id }, data: { label: l.slice(0, 60) } });
  revalidatePath('/settings');
  revalidatePath('/finance');
}

// Client-friendly delete (no redirect) for the inline editor.
export async function deleteOptionById(id: string) {
  if (!id) return;
  await prisma.optionItem.delete({ where: { id } });
  revalidatePath('/settings');
}

// Live "test connection" for the Settings integrations panel. Only runs the
// network probe for the integration the user clicked; returns ok + a message.
export async function testIntegration(id: string): Promise<{ ok: boolean; message: string }> {
  const s = await getSession();
  if (!s) return { ok: false, message: 'Not authorized.' };
  switch (id) {
    case 'drive':
      return testDriveConnection();
    case 'email':
      return verifyEmailConnection();
    case 'openrouter':
      return testOpenRouter();
    case 'wave':
      return testWave();
    case 'x':
      return testTwitterApi();
    default:
      return { ok: false, message: 'Nothing to test for this integration.' };
  }
}

/** Save the current user's notification category toggles (which alerts push). */
export async function saveNotifyPrefs(prefs: Record<string, boolean>) {
  const user = await getSession();
  if (!user) return;
  const clean: Record<string, boolean> = {};
  for (const c of NOTIFY_CATEGORIES) clean[c.id] = prefs?.[c.id] !== false; // default on
  await prisma.user.update({ where: { id: user.id }, data: { notifyPrefs: clean } });
  revalidatePath('/settings');
}

/** Change the signed-in user's login email (their username), confirmed by password. */
export async function changeEmail(newEmail: string, currentPassword: string): Promise<{ ok: boolean; message: string }> {
  const user = await getSession();
  if (!user) return { ok: false, message: 'Not signed in.' };
  const email = (newEmail ?? '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: 'Enter a valid email.' };
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.passwordHash || !(await bcrypt.compare(currentPassword, dbUser.passwordHash))) {
    return { ok: false, message: 'Current password is incorrect.' };
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== user.id) return { ok: false, message: 'That email is already in use.' };
  await prisma.user.update({ where: { id: user.id }, data: { email } });
  revalidatePath('/settings');
  return { ok: true, message: 'Email updated — use it next time you sign in.' };
}

/** Change the signed-in user's password, confirmed by their current one. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
  const user = await getSession();
  if (!user) return { ok: false, message: 'Not signed in.' };
  if ((newPassword ?? '').length < 8) return { ok: false, message: 'New password must be at least 8 characters.' };
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.passwordHash || !(await bcrypt.compare(currentPassword, dbUser.passwordHash))) {
    return { ok: false, message: 'Current password is incorrect.' };
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
  return { ok: true, message: 'Password updated.' };
}

/** Save an integration credential from the dashboard (encrypted at rest). */
export async function saveIntegrationSecret(name: string, value: string): Promise<{ ok: boolean; message: string }> {
  await requireSuperAdmin();
  if (!isManagedSecret(name)) return { ok: false, message: 'That key can’t be set from here.' };
  try {
    await setSecret(name, value);
    revalidatePath('/settings');
    return { ok: true, message: `${name} saved.` };
  } catch (e: any) {
    return { ok: false, message: e?.message?.slice(0, 160) ?? 'Could not save.' };
  }
}

/** Remove a dashboard-saved credential; it falls back to the deployment env if set there. */
export async function clearIntegrationSecret(name: string): Promise<{ ok: boolean; message: string }> {
  await requireSuperAdmin();
  if (!isManagedSecret(name)) return { ok: false, message: 'That key can’t be cleared from here.' };
  await clearSecret(name);
  revalidatePath('/settings');
  return { ok: true, message: `${name} cleared.` };
}

// ─── Wave Accounting: import invoices → link to clients & payments ────────────

export async function importWaveInvoices(): Promise<{ ok: boolean; message: string }> {
  await requireSuperAdmin();
  if (!waveConfigured()) return { ok: false, message: 'Wave is not configured (set WAVE_FULL_ACCESS_TOKEN).' };

  let businesses;
  try {
    businesses = await getWaveBusinesses();
  } catch (e: any) {
    return { ok: false, message: e?.message?.slice(0, 200) ?? 'Wave connection failed.' };
  }
  const bizId = process.env.WAVE_BUSINESS_ID?.trim() || businesses[0]?.id;
  if (!bizId) return { ok: false, message: 'No Wave business found on this account.' };

  let invoices;
  try {
    invoices = await getWaveInvoices(bizId);
  } catch (e: any) {
    return { ok: false, message: e?.message?.slice(0, 200) ?? 'Could not load Wave invoices.' };
  }
  if (invoices.length === 0) return { ok: true, message: 'No invoices found in Wave.' };

  const rates = await getRatesToCad();
  const existingClients = await prisma.client.findMany({ select: { id: true, name: true, email: true } });
  const byName = new Map(existingClients.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const byEmail = new Map(existingClients.filter((c) => c.email).map((c) => [c.email!.trim().toLowerCase(), c.id]));

  let created = 0, updated = 0, clientsCreated = 0, paymentsLinked = 0;

  for (const inv of invoices) {
    const cname = (inv.customerName || 'Wave customer').trim();
    const cemail = inv.customerEmail?.trim() || null;
    let clientId = (cemail ? byEmail.get(cemail.toLowerCase()) : undefined) || byName.get(cname.toLowerCase()) || null;
    if (!clientId) {
      const c = await prisma.client.create({ data: { name: cname.slice(0, 200), email: cemail, taxRegion: 'QC' }, select: { id: true } });
      clientId = c.id;
      clientsCreated++;
      byName.set(cname.toLowerCase(), c.id);
      if (cemail) byEmail.set(cemail.toLowerCase(), c.id);
    }

    const status = mapWaveStatus(inv.status);
    const issuedAt = inv.invoiceDate ? new Date(`${inv.invoiceDate}T00:00:00Z`) : new Date();
    const dueAt = inv.dueDate ? new Date(`${inv.dueDate}T00:00:00Z`) : null;
    const currency = CURRENCIES.includes(inv.currency) ? inv.currency : 'CAD';
    const data = {
      amount: inv.total,
      currency,
      status: status as any,
      clientId,
      issuedAt,
      dueAt,
      externalSource: 'WAVE',
      externalNumber: inv.invoiceNumber,
      notes: `Wave invoice ${inv.invoiceNumber ?? inv.id}`,
    };

    const existing = await prisma.invoice.findUnique({ where: { externalId: inv.id }, select: { id: true } });
    let invoiceId: string;
    if (existing) {
      await prisma.invoice.update({ where: { id: existing.id }, data });
      invoiceId = existing.id;
      updated++;
    } else {
      const c = await prisma.invoice.create({ data: { ...data, externalId: inv.id }, select: { id: true } });
      invoiceId = c.id;
      created++;
    }

    // Best-effort: link one existing unlinked payment (from bank import) whose
    // amount closely matches the invoice total, within ~120 days. Conservative
    // to avoid mis-linking; partial/multi-payment matching is left manual.
    const targetCad = toCad(inv.total, currency, rates);
    if (targetCad > 0) {
      const candidates = await prisma.payment.findMany({
        where: { clientId, invoiceId: null },
        select: { id: true, amount: true, currency: true, amountCad: true, paidAt: true },
      });
      let best: { id: string } | null = null;
      let bestDiff = Infinity;
      for (const p of candidates) {
        const pCad = p.amountCad ?? toCad(p.amount, p.currency, rates);
        const diff = Math.abs(pCad - targetCad);
        const days = Math.abs((p.paidAt.getTime() - issuedAt.getTime()) / 86400000);
        if (diff <= Math.max(1, targetCad * 0.02) && days <= 120 && diff < bestDiff) { best = { id: p.id }; bestDiff = diff; }
      }
      if (best) {
        await prisma.payment.update({ where: { id: best.id }, data: { invoiceId, bankMatchedAt: new Date() } });
        await syncInvoiceStatus(invoiceId);
        paymentsLinked++;
      }
    }
  }

  revalidatePath('/invoices');
  revalidatePath('/finance');
  return {
    ok: true,
    message: `Imported ${created} new + ${updated} updated invoice(s); created ${clientsCreated} client(s); linked ${paymentsLinked} payment(s).`,
  };
}

// ─── Company settings ────────────────────────────────────────────────────────

export async function saveCompanySettings(formData: FormData) {
  const num = (v: string | null, d: number) => {
    const n = v ? Number(v) : NaN;
    return !Number.isNaN(n) && n >= 0 ? n : d;
  };
  const data = {
    name: str(formData.get('name')) || 'UA Agency',
    email: str(formData.get('email')),
    phone: str(formData.get('phone')),
    website: str(formData.get('website')),
    address: str(formData.get('address')),
    gstNumber: str(formData.get('gstNumber')),
    qstNumber: str(formData.get('qstNumber')),
    neqNumber: str(formData.get('neqNumber')),
    corporationNumber: str(formData.get('corporationNumber')),
    identificationNumber: str(formData.get('identificationNumber')),
    gstRate: num(str(formData.get('gstRate')), 5),
    qstRate: num(str(formData.get('qstRate')), 9.975),
  };
  await prisma.companySetting.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });
  revalidatePath('/settings');
  redirect('/settings?done=company');
}

// ─── Edit / delete (rows) ────────────────────────────────────────────────────

export async function updateClient(formData: FormData) {
  const id = str(formData.get('clientId'));
  if (!id) return;
  await prisma.client.update({
    where: { id },
    data: {
      name: str(formData.get('name')) || 'Client',
      contactName: str(formData.get('contactName')),
      email: str(formData.get('clientEmail')),
      phone: str(formData.get('clientPhone')),
      source: str(formData.get('source')) || null,
      sourceOther: str(formData.get('sourceOther')),
      industry: str(formData.get('industry')),
      location: str(formData.get('location')),
      website: str(formData.get('website')),
      socialLinks: str(formData.get('socialLinks')),
      leadType: str(formData.get('leadType')) || null,
      taxRegion: str(formData.get('taxRegion')) || null,
      salespersonId: str(formData.get('salespersonId')) || null,
    },
  });
  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClient(id: string) {
  if (!id) return;
  await prisma.client.delete({ where: { id } });
  revalidatePath('/clients');
  revalidatePath('/projects');
  revalidatePath('/');
}

export async function updateUser(formData: FormData) {
  const id = str(formData.get('userId'));
  if (!id) return;
  const roles = formData.getAll('roles').map((r) => r.toString()).filter((r) => ROLES.includes(r)) as any[];
  await prisma.user.update({
    where: { id },
    data: {
      name: str(formData.get('name')) || 'Member',
      email: (str(formData.get('email')) || '').toLowerCase(),
      roles,
    },
  });
  revalidatePath('/team');
  redirect('/team');
}

export async function deleteUser(id: string) {
  if (!id) return;
  await prisma.user.delete({ where: { id } });
  revalidatePath('/team');
}

export async function updateProject(formData: FormData) {
  const id = str(formData.get('projectId'));
  if (!id) return;
  const data: any = buildProjectData(formData);
  const { members, ...scalars } = data;
  await prisma.project.update({ where: { id }, data: scalars });
  await prisma.projectMember.deleteMany({ where: { projectId: id } });
  if (members?.create?.length) {
    await prisma.projectMember.createMany({
      data: members.create.map((m: any) => ({ projectId: id, userId: m.userId, role: m.role })),
    });
  }
  revalidatePath(`/projects/${id}`);
  revalidatePath('/projects');
  revalidatePath('/clients');
  redirect(`/projects/${id}`);
}

export async function deleteProject(id: string) {
  if (!id) return;
  await prisma.project.delete({ where: { id } });
  revalidatePath('/projects');
  revalidatePath('/clients');
  revalidatePath('/');
}

export async function deleteInvoice(id: string) {
  if (!id) return;
  await prisma.invoice.delete({ where: { id } });
  revalidatePath('/invoices');
}

export async function deletePayment(id: string) {
  if (!id) return;
  const p = await prisma.payment.findUnique({ where: { id }, select: { clientId: true, invoiceId: true } });
  await prisma.payment.delete({ where: { id } });
  // Re-reconcile the invoice this payment was applied to.
  if (p?.invoiceId) {
    await syncInvoiceStatus(p.invoiceId);
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${p.invoiceId}`);
  }
  if (p) revalidatePath(`/clients/${p.clientId}`);
  revalidatePath('/finance');
  revalidatePath('/');
}

export async function deleteExpense(id: string) {
  if (!id) return;
  await prisma.expense.delete({ where: { id } });
  revalidatePath('/finance');
}

export async function deleteSalaryPayment(id: string) {
  if (!id) return;
  await prisma.salaryPayment.delete({ where: { id } });
  revalidatePath('/finance');
}

export async function deleteCommissionPayout(id: string) {
  if (!id) return;
  const p = await prisma.commissionPayout.findUnique({ where: { id }, select: { userId: true } });
  await prisma.commissionPayout.delete({ where: { id } });
  revalidatePath('/commissions');
  if (p) revalidatePath(`/commissions/${p.userId}`);
}

// ─── Statement import → expenses ─────────────────────────────────────────────

type ImportItem = {
  title?: string;
  category?: string;
  amount?: number | string;
  currency?: string;
  date?: string;
  note?: string;
};

// Bulk-create expenses from a parsed bank / credit-card statement. Any line
// whose description reads as interest is relabelled "Interest expense".
export async function importStatementExpenses(items: ImportItem[]): Promise<{ count: number }> {
  if (!Array.isArray(items) || items.length === 0) return { count: 0 };

  const rates = await getRatesToCad();
  const data = items
    .map((it) => {
      const amount = typeof it.amount === 'string' ? Number(it.amount) : it.amount ?? 0;
      if (!amount || Number.isNaN(amount) || amount <= 0) return null;

      let title = (it.title ?? '').trim() || 'Expense';
      let category = normCat(it.category);
      // The interest → fee rule, enforced server-side regardless of the client.
      if (/interest/i.test(title)) {
        title = 'Interest expense';
        category = 'FEES';
      }

      const currency = CURRENCIES.includes(it.currency ?? '') ? (it.currency as string) : 'CAD';
      const fxRate = currency === 'CAD' ? 1 : rates[currency] ?? null;
      const amountCad = toCad(amount, currency, rates);
      const date = it.date ? new Date(it.date) : new Date();
      if (Number.isNaN(date.getTime())) return null;

      return {
        title,
        category,
        amount,
        currency,
        amountCad,
        fxRate,
        date,
        note: (it.note ?? '').trim() || 'Imported from statement',
        reimbursed: true, // company-paid
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  if (data.length) await prisma.expense.createMany({ data });
  revalidatePath('/finance');
  return { count: data.length };
}

// Add a new expense/income category on the fly (from the import review or the
// finance forms). Returns the created/existing option so the client can select
// it immediately. Seeds the built-in defaults into the DB first, so adding a
// custom one doesn't hide them.
export async function addOptionCategory(
  kind: string,
  label: string,
): Promise<{ value: string; label: string } | null> {
  if (kind !== 'expenseCategory' && kind !== 'incomeCategory') return null;
  const name = (label ?? '').trim();
  if (!name) return null;

  const rows = await prisma.optionItem.findMany({ where: { kind }, select: { value: true } });
  if (rows.length === 0) {
    await prisma.optionItem.createMany({
      data: (DEFAULT_OPTIONS[kind] ?? []).map((o, i) => ({ kind, value: o.value, label: o.label, order: i })),
      skipDuplicates: true,
    });
  }

  const value = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'CUSTOM';
  const existing = await prisma.optionItem.findUnique({ where: { kind_value: { kind, value } } }).catch(() => null);
  if (existing) return { value: existing.value, label: existing.label };

  const max = await prisma.optionItem.aggregate({ where: { kind }, _max: { order: true } });
  const created = await prisma.optionItem.create({
    data: { kind, value, label: name, order: (max._max.order ?? -1) + 1 },
  });
  revalidatePath('/finance');
  revalidatePath('/finance/import');
  return { value: created.value, label: created.label };
}

// A single reviewed line from a statement, either direction.
type StatementLine = {
  type?: 'expense' | 'income';
  title?: string;
  category?: string;
  amount?: number | string;
  currency?: string;
  date?: string;
  note?: string;
  taxIncluded?: boolean; // expenses only — back GST/QST out of the total (CAD)
  rawDesc?: string;      // original parsed description, for learning rules
};

// Import a reviewed statement: expenses become Expense rows; every credit
// becomes a categorizable Income (OtherIncome) row so nothing is dropped — the
// full set of bank credits is captured for review/audit and can be recategorized.
export async function importStatementLines(
  items: StatementLine[],
): Promise<{ expenses: number; income: number }> {
  if (!Array.isArray(items) || items.length === 0) return { expenses: 0, income: 0 };

  const rates = await getRatesToCad();
  const company = await getCompany();

  const clean = items
    .map((it) => {
      const amount = typeof it.amount === 'string' ? Number(it.amount) : it.amount ?? 0;
      if (!amount || Number.isNaN(amount) || amount <= 0) return null;
      const currency = CURRENCIES.includes(it.currency ?? '') ? (it.currency as string) : 'CAD';
      const date = it.date ? new Date(it.date) : new Date();
      if (Number.isNaN(date.getTime())) return null;
      const amountCad = toCad(amount, currency, rates);
      const fxRate = currency === 'CAD' ? 1 : rates[currency] ?? null;
      return { it, amount, currency, date, amountCad, fxRate };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // ── Expenses ──
  const expenseData = clean
    .filter((x) => x.it.type !== 'income')
    .map(({ it, amount, currency, date, amountCad, fxRate }) => {
      let title = (it.title ?? '').trim() || 'Expense';
      let category = normCat(it.category);
      if (/interest/i.test(title)) {
        title = 'Interest expense';
        category = 'FEES';
      }
      let gst: number | null = null;
      let qst: number | null = null;
      if (it.taxIncluded && currency === 'CAD') {
        const t = backOutExpenseTax(amount, company);
        gst = t.gst;
        qst = t.qst;
      }
      return {
        title,
        category,
        amount,
        currency,
        amountCad,
        fxRate,
        gst,
        qst,
        date,
        note: (it.note ?? '').trim() || 'Imported from statement',
        reimbursed: true, // company-paid
      };
    });
  if (expenseData.length) await prisma.expense.createMany({ data: expenseData });

  // ── Income: every credit becomes a categorizable Income row ──
  const otherIncomeData = clean
    .filter((x) => x.it.type === 'income')
    .map(({ it, currency, date, amount, amountCad, fxRate }) => {
      const category = normCat(it.category);
      return {
        title: (it.title ?? '').trim() || 'Bank credit',
        category,
        amount,
        currency,
        amountCad,
        fxRate,
        date,
        note: (it.note ?? '').trim() || 'Imported from statement',
        source: 'STATEMENT',
      };
    });
  if (otherIncomeData.length) await prisma.otherIncome.createMany({ data: otherIncomeData });

  // ── Learn categorization rules from this import (last choice wins) ──
  // Keyed by a normalized description; remembers type + category, and the title
  // only when it was a deliberate rename (not just the raw description).
  const rules = new Map<string, { type: string; category: string; title: string | null }>();
  for (const { it } of clean) {
    const key = ruleKey(it.rawDesc || it.title || '');
    if (key.length < 3) continue;
    const type = it.type === 'income' ? 'income' : 'expense';
    const category = normCat(it.category);
    const renamed = (it.title ?? '').trim() && (it.title ?? '').trim().toUpperCase() !== (it.rawDesc ?? '').trim().toUpperCase();
    rules.set(key, { type, category, title: renamed ? (it.title as string).trim() : null });
  }
  for (const [matchKey, r] of rules) {
    try {
      await prisma.txnRule.upsert({
        where: { matchKey },
        // Only overwrite a learned title when this import provided a new rename.
        create: { matchKey, type: r.type, category: r.category, title: r.title },
        update: { type: r.type, category: r.category, hits: { increment: 1 }, ...(r.title ? { title: r.title } : {}) },
      });
    } catch {
      // a rule write should never block the import
    }
  }

  revalidatePath('/finance');
  return { expenses: expenseData.length, income: otherIncomeData.length };
}

// ─── Other income (non-client) ───────────────────────────────────────────────

export async function addOtherIncome(formData: FormData) {
  const title = str(formData.get('title'));
  if (!title) throw new Error('A title is required.');
  const amountRaw = str(formData.get('amount'));
  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) throw new Error('A valid amount is required.');

  const currency = str(formData.get('currency')) ?? 'CAD';
  const dateRaw = str(formData.get('date'));
  const rates = await getRatesToCad();

  const categoryRaw = str(formData.get('category'));
  await prisma.otherIncome.create({
    data: {
      title,
      category: normCat(categoryRaw),
      amount,
      currency,
      amountCad: toCad(amount, currency, rates),
      fxRate: currency === 'CAD' ? 1 : rates[currency] ?? null,
      date: dateRaw ? new Date(dateRaw) : new Date(),
      note: str(formData.get('note')),
      source: 'MANUAL',
    },
  });
  revalidatePath('/finance');
  redirect('/finance?tab=pnl');
}

export async function deleteOtherIncome(id: string) {
  if (!id) return;
  await prisma.otherIncome.delete({ where: { id } });
  revalidatePath('/finance');
}

// ─── Transfers (non-P&L money movements, e.g. credit-card payments) ───────────

export async function deleteTransfer(id: string) {
  if (!id) return;
  await prisma.transfer.delete({ where: { id } });
  revalidatePath('/finance');
}

// One-off: convert expenses that were mis-imported as "Credit card payment" into
// transfers, so they leave the P&L and their GST/QST input tax credits.
export async function reclassifyCreditCardPayments(): Promise<{ ok: boolean; message: string }> {
  await requireSuperAdmin();
  const exps = await prisma.expense.findMany({ where: { category: 'CREDIT_CARD_PAYMENT' } });
  if (exps.length === 0) return { ok: true, message: 'No credit-card-payment expenses to reclassify.' };
  for (const e of exps) {
    await prisma.transfer.create({
      data: {
        title: e.title,
        category: 'CREDIT_CARD_PAYMENT',
        amount: e.amount,
        currency: e.currency,
        amountCad: e.amountCad,
        fxRate: e.fxRate,
        date: e.date,
        note: e.note,
        source: 'RECLASSIFIED',
      },
    });
    await prisma.expense.delete({ where: { id: e.id } });
  }
  revalidatePath('/finance');
  return { ok: true, message: `Reclassified ${exps.length} credit-card payment${exps.length === 1 ? '' : 's'} as transfers (removed from P&L and GST).` };
}

// The UTC month range a statement covers, from its period label or filename.
function monthRangeFromStatement(periodLabel: string | null, fileName: string): { start: Date; end: Date } | null {
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const src = `${periodLabel ?? ''} ${fileName ?? ''}`.toLowerCase();
  const ym = src.match(/(20\d{2})/);
  if (!ym) return null;
  const year = Number(ym[1]);
  let month = MONTHS.findIndex((m) => new RegExp(`\\b${m}`).test(src));
  if (month < 0) {
    const m = src.replace(/20\d{2}/g, ' ').match(/\b(0?[1-9]|1[0-2])\b/);
    if (m) month = Number(m[1]) - 1;
  }
  if (month < 0) return null;
  return { start: new Date(Date.UTC(year, month, 1)), end: new Date(Date.UTC(year, month + 1, 1)) };
}

// Clear an import: delete the transactions it created and the archived file, so
// the statement can be re-uploaded. Tagged rows are removed precisely; older
// (untagged) imports fall back to import-marked rows within the statement's
// month. Manual entries are never touched.
export async function clearStatementImport(statementId: string): Promise<{ ok: boolean; message: string }> {
  const session = await getSession();
  if (!session?.roles?.includes('SUPER_ADMIN')) return { ok: false, message: 'Not authorized.' };
  if (!statementId) return { ok: false, message: 'No statement given.' };
  const stmt = await prisma.statement.findUnique({ where: { id: statementId }, select: { id: true, periodLabel: true, fileName: true } });
  if (!stmt) return { ok: false, message: 'Statement not found.' };

  // 1) Precisely tagged rows (imports made after import-tracking landed).
  const tagged = await Promise.all([
    prisma.expense.deleteMany({ where: { statementId } }),
    prisma.otherIncome.deleteMany({ where: { statementId } }),
    prisma.payment.deleteMany({ where: { statementId } }),
    prisma.transfer.deleteMany({ where: { statementId } }),
  ]);
  let removed = tagged.reduce((s, r) => s + r.count, 0);

  // 2) Legacy fallback: untagged import → import-marked rows in the period only.
  if (removed === 0) {
    const range = monthRangeFromStatement(stmt.periodLabel, stmt.fileName);
    if (range) {
      const { start, end } = range;
      const legacy = await Promise.all([
        prisma.expense.deleteMany({ where: { statementId: null, note: 'Imported from statement', date: { gte: start, lt: end } } }),
        prisma.otherIncome.deleteMany({ where: { statementId: null, source: 'STATEMENT', date: { gte: start, lt: end } } }),
        prisma.payment.deleteMany({ where: { statementId: null, invoiceId: null, bankMatchedAt: { not: null }, paidAt: { gte: start, lt: end } } }),
        prisma.transfer.deleteMany({ where: { statementId: null, source: 'STATEMENT', date: { gte: start, lt: end } } }),
      ]);
      removed = legacy.reduce((s, r) => s + r.count, 0);
    }
  }

  await prisma.statement.delete({ where: { id: statementId } });
  revalidatePath('/finance');
  revalidatePath('/statements');
  return { ok: true, message: `Cleared ${removed} imported transaction${removed === 1 ? '' : 's'} and removed the statement — re-upload to redo it.` };
}

// Undo a commit: rebuild the pending import from the transactions it created +
// the archived file, then delete those transactions and the statement — so the
// statement goes back to the review board exactly as it was.
export async function revertStatementToPending(statementId: string): Promise<{ ok: boolean; message: string }> {
  const session = await getSession();
  if (!session?.roles?.includes('SUPER_ADMIN')) return { ok: false, message: 'Not authorized.' };
  if (!statementId) return { ok: false, message: 'No statement given.' };
  const stmt = await prisma.statement.findUnique({ where: { id: statementId } });
  if (!stmt) return { ok: false, message: 'Statement not found.' };

  // Prefer precisely-tagged rows; fall back to import-marked rows in the period.
  let where: { expense: any; otherIncome: any; payment: any; transfer: any } = {
    expense: { statementId }, otherIncome: { statementId }, payment: { statementId }, transfer: { statementId },
  };
  const tagged =
    (await prisma.expense.count({ where: { statementId } })) +
    (await prisma.otherIncome.count({ where: { statementId } })) +
    (await prisma.payment.count({ where: { statementId } })) +
    (await prisma.transfer.count({ where: { statementId } }));
  if (tagged === 0) {
    const range = monthRangeFromStatement(stmt.periodLabel, stmt.fileName);
    if (!range) return { ok: false, message: 'No linked transactions found to revert.' };
    const { start, end } = range;
    where = {
      expense: { statementId: null, note: 'Imported from statement', date: { gte: start, lt: end } },
      otherIncome: { statementId: null, source: 'STATEMENT', date: { gte: start, lt: end } },
      payment: { statementId: null, invoiceId: null, bankMatchedAt: { not: null }, paidAt: { gte: start, lt: end } },
      transfer: { statementId: null, source: 'STATEMENT', date: { gte: start, lt: end } },
    };
  }

  const [expenses, others, payments, transfers] = await Promise.all([
    prisma.expense.findMany({ where: where.expense }),
    prisma.otherIncome.findMany({ where: where.otherIncome }),
    prisma.payment.findMany({ where: where.payment }),
    prisma.transfer.findMany({ where: where.transfer }),
  ]);
  const total = expenses.length + others.length + payments.length + transfers.length;
  if (total === 0) return { ok: false, message: 'No imported transactions found for this statement.' };

  const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
  const taxOf = (g: number | null, q: number | null): 'none' | 'gst' | 'both' => ((q ?? 0) > 0 ? 'both' : (g ?? 0) > 0 ? 'gst' : 'none');
  const lines: ImportLine[] = [
    ...expenses.map((e): ImportLine => ({ include: true, type: 'expense', title: e.title, category: e.category, amount: e.amount, date: iso(e.date), rawDesc: e.title, tax: taxOf(e.gst, e.qst), clientId: null, note: e.note && e.note !== 'Imported from statement' ? e.note : undefined })),
    ...payments.map((p): ImportLine => ({ include: true, type: 'income', title: p.note && p.note !== 'From statement' ? p.note : 'Client payment', category: 'CLIENT_PAYMENT', amount: p.amount, date: iso(p.paidAt), rawDesc: p.note || 'Client payment', tax: taxOf(p.gst, p.qst), clientId: p.clientId })),
    ...others.map((o): ImportLine => ({ include: true, type: 'income', title: o.title, category: o.category, amount: o.amount, date: iso(o.date), rawDesc: o.title, tax: taxOf(o.gst, o.qst), clientId: null })),
    ...transfers.map((t): ImportLine => ({ include: true, type: 'transfer', title: t.title, category: t.category, amount: t.amount, date: iso(t.date), rawDesc: t.title, tax: 'none', clientId: null })),
  ];
  const curr = expenses[0]?.currency || payments[0]?.currency || others[0]?.currency || transfers[0]?.currency || 'CAD';

  await prisma.pendingImport.create({
    data: {
      fileName: stmt.fileName,
      accountType: stmt.accountType,
      accountLabel: stmt.accountLabel,
      currency: CURRENCIES.includes(curr) ? curr : 'CAD',
      lines: lines as any,
      mimeType: stmt.mimeType,
      data: stmt.data,
      createdById: session.id,
    },
  });

  await Promise.all([
    prisma.expense.deleteMany({ where: where.expense }),
    prisma.otherIncome.deleteMany({ where: where.otherIncome }),
    prisma.payment.deleteMany({ where: where.payment }),
    prisma.transfer.deleteMany({ where: where.transfer }),
  ]);
  await prisma.statement.delete({ where: { id: statementId } });

  revalidatePath('/finance');
  revalidatePath('/statements');
  revalidatePath('/finance/import');
  return { ok: true, message: `Reverted ${total} transaction${total === 1 ? '' : 's'} back to a pending import.` };
}

// One-click: undo the most recent import (the batch of statements committed
// together), reverting them all back to pending imports.
export async function undoLastImport(): Promise<{ ok: boolean; message: string }> {
  const session = await getSession();
  if (!session?.roles?.includes('SUPER_ADMIN')) return { ok: false, message: 'Not authorized.' };
  const latest = await prisma.statement.findFirst({ where: { source: 'IMPORT' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  if (!latest) return { ok: false, message: 'No imported statements to undo.' };
  // Statements committed together share (near-)identical createdAt; take the
  // recent cluster (15 min window from the latest) as "the last import".
  const windowStart = new Date(latest.createdAt.getTime() - 15 * 60 * 1000);
  const batch = await prisma.statement.findMany({ where: { source: 'IMPORT', createdAt: { gte: windowStart } }, select: { id: true }, orderBy: { createdAt: 'desc' } });
  return revertStatementsToPending(batch.map((b) => b.id));
}

// Revert several committed statements back to pending at once.
export async function revertStatementsToPending(ids: string[]): Promise<{ ok: boolean; message: string }> {
  const list = Array.from(new Set((ids ?? []).filter((x) => typeof x === 'string' && x)));
  if (list.length === 0) return { ok: false, message: 'Nothing selected.' };
  let done = 0;
  let txns = 0;
  for (const id of list) {
    try {
      const r = await revertStatementToPending(id);
      if (r.ok) { done++; const m = r.message.match(/Reverted (\d+)/); if (m) txns += Number(m[1]); }
    } catch { /* keep going */ }
  }
  return { ok: true, message: `Reverted ${done} statement${done === 1 ? '' : 's'} (${txns} transactions) back to pending imports.` };
}

// ─── Reset data (super-admin) ────────────────────────────────────────────────
// Wipe selected categories of transactional data back to zero, keeping all
// settings (company details, dropdown options, users, integrations).

export async function resetData(scopes: string[]): Promise<{ ok: boolean; message: string }> {
  const RESET_SCOPES = ['finance', 'invoices', 'statements', 'filings', 'loans', 'commissions', 'salaryPayments', 'time', 'leads', 'projects', 'clients'];
  const session = await getSession();
  if (!session?.roles?.includes('SUPER_ADMIN')) return { ok: false, message: 'Not authorized — super admins only.' };
  const set = new Set((scopes ?? []).filter((s) => RESET_SCOPES.includes(s)));
  if (set.size === 0) return { ok: false, message: 'Nothing selected.' };

  const parts: string[] = [];
  const run = async (cond: boolean, label: string, ops: (() => Promise<{ count: number }>)[]) => {
    if (!cond) return;
    let c = 0;
    for (const op of ops) { const r = await op(); c += r?.count ?? 0; }
    parts.push(`${label} ${c}`);
  };

  await run(set.has('finance'), 'income/expenses', [
    () => prisma.payment.deleteMany({}),
    () => prisma.otherIncome.deleteMany({}),
    () => prisma.expense.deleteMany({}),
    () => prisma.transfer.deleteMany({}),
  ]);
  await run(set.has('invoices'), 'invoices', [() => prisma.invoice.deleteMany({})]);
  await run(set.has('statements'), 'statements/import-memory', [
    () => prisma.statement.deleteMany({}),
    () => prisma.pendingImport.deleteMany({}),
    () => prisma.txnRule.deleteMany({}),
  ]);
  await run(set.has('filings'), 'GST/QST filings', [() => prisma.quarterlyFiling.deleteMany({})]);
  await run(set.has('loans'), 'loans', [() => prisma.loan.deleteMany({})]);
  await run(set.has('commissions'), 'commission payouts', [() => prisma.commissionPayout.deleteMany({})]);
  await run(set.has('salaryPayments'), 'salary payments', [() => prisma.salaryPayment.deleteMany({})]);
  await run(set.has('time'), 'time entries', [
    () => prisma.timeEntry.deleteMany({}),
    () => prisma.taskActivity.deleteMany({}),
  ]);
  await run(set.has('leads'), 'leads', [
    () => prisma.leadActivity.deleteMany({}),
    () => prisma.sequenceEnrollment.deleteMany({}),
    () => prisma.lead.deleteMany({}),
    () => prisma.leadCompany.deleteMany({}),
  ]);
  await run(set.has('projects'), 'projects', [() => prisma.project.deleteMany({})]);
  await run(set.has('clients'), 'clients', [() => prisma.client.deleteMany({})]);

  for (const p of ['/finance', '/invoices', '/statements', '/clients', '/projects', '/leads', '/time', '/commissions', '/']) revalidatePath(p);
  return { ok: true, message: `Erased — ${parts.join(', ')}.` };
}

// ─── Fix the GST/QST on a single transaction (recomputes from the amount) ─────

const TAX_MODES = ['none', 'gst', 'both'];
async function taxPortion(baseCad: number, tax: string): Promise<{ gst: number; qst: number }> {
  if (tax === 'none' || !(baseCad > 0)) return { gst: 0, qst: 0 };
  const company = await getCompany();
  const t = backOutTax(baseCad, { gst: true, qst: tax === 'both', company });
  return { gst: t.gst, qst: tax === 'both' ? t.qst : 0 };
}

export async function setExpenseTax(id: string, tax: string) {
  if (!id || !TAX_MODES.includes(tax)) return;
  const e = await prisma.expense.findUnique({ where: { id }, select: { amount: true, currency: true, amountCad: true } });
  if (!e) return;
  const base = e.currency === 'CAD' ? e.amount : e.amountCad ?? e.amount;
  const { gst, qst } = await taxPortion(base, tax);
  await prisma.expense.update({ where: { id }, data: { gst, qst } });
  revalidatePath('/finance');
}

export async function setPaymentTax(id: string, tax: string) {
  if (!id || !TAX_MODES.includes(tax)) return;
  const p = await prisma.payment.findUnique({ where: { id }, select: { amount: true, currency: true, amountCad: true, clientId: true } });
  if (!p) return;
  const base = p.currency === 'CAD' ? p.amount : p.amountCad ?? p.amount;
  const { gst, qst } = await taxPortion(base, tax);
  await prisma.payment.update({ where: { id }, data: { gst, qst } });
  revalidatePath('/finance');
  revalidatePath(`/clients/${p.clientId}`);
}

export async function setOtherIncomeTax(id: string, tax: string) {
  if (!id || !TAX_MODES.includes(tax)) return;
  const o = await prisma.otherIncome.findUnique({ where: { id }, select: { amount: true, currency: true, amountCad: true } });
  if (!o) return;
  const base = o.currency === 'CAD' ? o.amount : o.amountCad ?? o.amount;
  const { gst, qst } = await taxPortion(base, tax);
  await prisma.otherIncome.update({ where: { id }, data: { gst, qst } });
  revalidatePath('/finance');
}

// Re-categorize an income entry (inline, from the income list).
export async function updateOtherIncomeCategory(id: string, category: string) {
  if (!id) return;
  await prisma.otherIncome.update({ where: { id }, data: { category: normCat(category) } });
  revalidatePath('/finance');
}

// Attribute an income entry to a client: converts it into a client Payment (so
// it shows on the client's profile) and removes the standalone income row.
export async function assignIncomeToClient(id: string, clientId: string) {
  if (!id || !clientId) return;
  const inc = await prisma.otherIncome.findUnique({ where: { id } });
  if (!inc) return;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return;

  const rates = await getRatesToCad();
  await prisma.payment.create({
    data: {
      clientId,
      amount: inc.amount,
      currency: inc.currency,
      amountCad: inc.amountCad ?? toCad(inc.amount, inc.currency, rates),
      fxRate: inc.fxRate ?? (inc.currency === 'CAD' ? 1 : rates[inc.currency] ?? null),
      gst: inc.gst,
      qst: inc.qst,
      method: 'BANK_TRANSFER',
      paidAt: inc.date,
      note: inc.note ? `${inc.title} — ${inc.note}` : inc.title,
      bankMatchedAt: inc.source === 'STATEMENT' ? new Date() : null,
    },
  });
  await prisma.otherIncome.delete({ where: { id } });
  revalidatePath('/finance');
  revalidatePath(`/clients/${clientId}`);
}

// Quick-add a client from the import review. Agency = business name, contact =
// person; at least one required. name = agency (or the contact if no agency).
export async function quickAddClient(
  agencyName: string,
  contactName: string,
): Promise<{ id: string; name: string } | null> {
  const agency = (agencyName ?? '').trim();
  const contact = (contactName ?? '').trim();
  const name = (agency || contact).slice(0, 160);
  if (!name) return null;
  const client = await prisma.client.create({
    data: { name, contactName: agency && contact ? contact.slice(0, 160) : null },
  });
  revalidatePath('/clients');
  return { id: client.id, name: client.name };
}

// ─── Pending statement imports (saved-for-later drafts) ──────────────────────

const PENDING_TYPES = ['BANK', 'CREDIT_CARD'];

export async function createPendingImport(payload: {
  fileName: string;
  mimeType: string;
  fileBase64: string;
  accountType: string;
  accountLabel: string;
  currency: string;
  note?: string;
  lines: ImportLine[];
}): Promise<{ id: string }> {
  const session = await getSession();
  const base64 = (payload.fileBase64 || '').replace(/^data:[^,]+,/, '');
  const buffer = base64 ? Buffer.from(base64, 'base64') : null;
  const p = await prisma.pendingImport.create({
    data: {
      fileName: (payload.fileName || 'statement').slice(0, 200),
      accountType: PENDING_TYPES.includes(payload.accountType) ? payload.accountType : 'BANK',
      accountLabel: (payload.accountLabel || payload.fileName || 'Statement').slice(0, 160),
      currency: CURRENCIES.includes(payload.currency) ? payload.currency : 'CAD',
      note: payload.note?.trim() || null,
      lines: (payload.lines ?? []) as any,
      mimeType: payload.mimeType || 'application/pdf',
      data: buffer,
      createdById: session?.id ?? null,
    },
    select: { id: true },
  });
  revalidatePath('/finance/import');
  return { id: p.id };
}

export async function savePendingImport(
  id: string,
  patch: { lines?: ImportLine[]; accountType?: string; accountLabel?: string; currency?: string; note?: string | null },
) {
  if (!id) return;
  const data: Record<string, any> = {};
  if (patch.lines) data.lines = patch.lines as any;
  if (patch.accountType) data.accountType = PENDING_TYPES.includes(patch.accountType) ? patch.accountType : 'BANK';
  if (patch.accountLabel !== undefined) data.accountLabel = (patch.accountLabel || 'Statement').slice(0, 160);
  if (patch.currency) data.currency = CURRENCIES.includes(patch.currency) ? patch.currency : 'CAD';
  if (patch.note !== undefined) data.note = patch.note?.trim() || null;
  if (Object.keys(data).length === 0) return;
  await prisma.pendingImport.update({ where: { id }, data });
  revalidatePath('/finance/import');
  revalidatePath(`/finance/import/${id}`);
}

// Flip a pending import's account type (Bank ↔ Credit card) from the list.
export async function setPendingImportType(id: string, type: string) {
  if (!id || !PENDING_TYPES.includes(type)) return;
  await prisma.pendingImport.update({ where: { id }, data: { accountType: type } });
  revalidatePath('/finance/import');
}

export async function deletePendingImport(id: string) {
  if (!id) return;
  await prisma.pendingImport.delete({ where: { id } });
  revalidatePath('/finance/import');
  redirect('/finance/import');
}

// Commit a pending import: create expenses / income / client payments from its
// lines (per-row GST/QST), learn rules, archive the file, then delete the draft.
async function commitPendingCore(id: string): Promise<{ ok: boolean; targetMonth: string }> {
  const p = await prisma.pendingImport.findUnique({ where: { id } });
  if (!p) return { ok: false, targetMonth: '' };

  const lines = ((p.lines as any as ImportLine[]) ?? []).filter((l) => l && l.include && Number(l.amount) > 0);
  const rates = await getRatesToCad();
  const company = await getCompany();
  const currency = CURRENCIES.includes(p.currency) ? p.currency : 'CAD';
  const now = new Date();

  const expenseData: any[] = [];
  const otherIncomeData: any[] = [];
  const paymentData: any[] = [];
  const transferData: any[] = [];

  for (const l of lines) {
    const amount = Number(l.amount);
    const date = l.date ? new Date(l.date) : now;
    if (Number.isNaN(date.getTime())) continue;
    const amountCad = toCad(amount, currency, rates);
    const fxRate = currency === 'CAD' ? 1 : rates[currency] ?? null;

    // Transfers (e.g. paying down the credit card) are not income or expenses
    // and carry no GST — record them, but keep them out of the P&L / GST.
    if (l.type === 'transfer') {
      transferData.push({
        title: (l.title || 'Transfer').slice(0, 200),
        category: normCat(l.category) || 'CREDIT_CARD_PAYMENT',
        amount, currency, amountCad, fxRate, date,
        note: l.note?.trim() || 'Imported from statement',
        source: 'STATEMENT',
      });
      continue;
    }

    // GST/QST for this line (collected on income, paid on expenses). Only CAD.
    let gst: number | null = null;
    let qst: number | null = null;
    if (currency === 'CAD' && (l.tax === 'gst' || l.tax === 'both')) {
      const t = backOutTax(amount, { gst: true, qst: l.tax === 'both', company });
      gst = t.gst;
      qst = l.tax === 'both' ? t.qst : 0;
    }

    if (l.type === 'income') {
      if (l.clientId) {
        paymentData.push({
          clientId: l.clientId,
          amount,
          currency,
          amountCad,
          fxRate,
          gst,
          qst,
          method: 'BANK_TRANSFER',
          paidAt: date,
          note: (l.note?.trim() || l.title || 'From statement').slice(0, 300),
          bankMatchedAt: now,
        });
      } else {
        otherIncomeData.push({
          title: (l.title || 'Bank credit').slice(0, 200),
          category: normCat(l.category),
          amount,
          currency,
          amountCad,
          fxRate,
          gst,
          qst,
          date,
          note: l.note?.trim() || 'Imported from statement',
          source: 'STATEMENT',
        });
      }
    } else {
      let title = (l.title || 'Expense').slice(0, 200);
      let category = normCat(l.category);
      if (/interest/i.test(title)) {
        title = 'Interest expense';
        category = 'FEES';
      }
      expenseData.push({ title, category, amount, currency, amountCad, fxRate, gst, qst, date, note: l.note?.trim() || 'Imported from statement', reimbursed: true });
    }
  }

  // Archive the original file to Statements FIRST, so every imported row can be
  // tagged with its statementId (lets the import be cleared / re-done later).
  let statementId: string | null = null;
  if (p.data) {
    const bytes = Buffer.from(p.data as Uint8Array);
    const stmt = await prisma.statement.create({
      data: {
        accountType: p.accountType,
        accountLabel: p.accountLabel,
        fileName: p.fileName,
        mimeType: p.mimeType,
        size: bytes.length,
        data: bytes,
        periodLabel: derivePeriodFromName(p.fileName),
        source: 'IMPORT',
        importedExpenses: expenseData.length,
        importedIncome: otherIncomeData.length + paymentData.length,
      },
      select: { id: true },
    });
    statementId = stmt.id;
    for (const d of expenseData) d.statementId = statementId;
    for (const d of otherIncomeData) d.statementId = statementId;
    for (const d of paymentData) d.statementId = statementId;
    for (const d of transferData) d.statementId = statementId;
  }

  if (expenseData.length) await prisma.expense.createMany({ data: expenseData });
  if (otherIncomeData.length) await prisma.otherIncome.createMany({ data: otherIncomeData });
  if (paymentData.length) await prisma.payment.createMany({ data: paymentData });
  if (transferData.length) await prisma.transfer.createMany({ data: transferData });

  // Learn categorization rules (last choice wins) — type, category, tax, and a
  // deliberate rename — so future imports pre-fill them automatically.
  const rules = new Map<string, { type: string; category: string; title: string | null; tax: string }>();
  for (const l of lines) {
    const key = ruleKey(l.rawDesc || l.title || '');
    if (key.length < 3) continue;
    const renamed = (l.title ?? '').trim() && (l.title ?? '').trim().toUpperCase() !== (l.rawDesc ?? '').trim().toUpperCase();
    const learnType = l.type === 'income' ? 'income' : l.type === 'transfer' ? 'transfer' : 'expense';
    const learnTax = l.type === 'transfer' ? 'none' : l.tax === 'gst' || l.tax === 'both' ? l.tax : 'none';
    rules.set(key, { type: learnType, category: normCat(l.category), title: renamed ? l.title.trim() : null, tax: learnTax });
  }
  for (const [matchKey, r] of rules) {
    try {
      await prisma.txnRule.upsert({
        where: { matchKey },
        create: { matchKey, type: r.type, category: r.category, title: r.title, tax: r.tax },
        update: { type: r.type, category: r.category, tax: r.tax, hits: { increment: 1 }, ...(r.title ? { title: r.title } : {}) },
      });
    } catch {
      /* rule write must never block commit */
    }
  }

  await prisma.pendingImport.delete({ where: { id } });
  revalidatePath('/finance');
  revalidatePath('/finance/import');
  revalidatePath('/statements');

  // Finance P&L / Expenses / Income are filtered by month (default = current
  // month). Land on the month the statement's transactions belong to, so the
  // imported rows are visible instead of hidden under the current month.
  const monthCounts = new Map<string, number>();
  for (const l of lines) {
    const d = l.date ? new Date(l.date) : null;
    if (d && !Number.isNaN(d.getTime())) {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }
  }
  let targetMonth = '';
  let best = 0;
  for (const [k, c] of monthCounts) if (c > best) { best = c; targetMonth = k; }
  return { ok: true, targetMonth };
}

// Commit one pending import and jump to the month its transactions land in.
export async function commitPendingImport(id: string): Promise<void> {
  const r = await commitPendingCore(id);
  redirect(r.targetMonth ? `/finance?tab=pnl&month=${r.targetMonth}` : '/finance?tab=pnl');
}

// Commit a chosen set of pending imports at once.
export async function commitSelectedPendingImports(ids: string[]): Promise<{ ok: boolean; message: string }> {
  const list = Array.from(new Set((ids ?? []).filter((x) => typeof x === 'string' && x)));
  if (list.length === 0) return { ok: false, message: 'Nothing selected.' };
  let done = 0;
  for (const id of list) {
    try { const r = await commitPendingCore(id); if (r.ok) done++; } catch { /* skip a bad one */ }
  }
  revalidatePath('/finance');
  revalidatePath('/finance/import');
  revalidatePath('/statements');
  return { ok: true, message: `Committed ${done} statement${done === 1 ? '' : 's'} — see them in Finance.` };
}

// Commit every pending import at once (uses each one's reviewed lines as-is).
export async function commitAllPendingImports(): Promise<{ ok: boolean; message: string }> {
  const pend = await prisma.pendingImport.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } });
  if (pend.length === 0) return { ok: false, message: 'No pending imports to commit.' };
  let done = 0;
  for (const { id } of pend) {
    try {
      const r = await commitPendingCore(id);
      if (r.ok) done++;
    } catch {
      /* skip a bad one, keep going */
    }
  }
  revalidatePath('/finance');
  revalidatePath('/finance/import');
  revalidatePath('/statements');
  return { ok: true, message: `Committed ${done} statement${done === 1 ? '' : 's'} — see them in Finance.` };
}

// ─── Quarterly GST/QST filing state ──────────────────────────────────────────

// Upsert per-quarter remittance state. `field` names which toggle/value to set.
export async function setQuarterlyFiling(formData: FormData) {
  const year = Number(str(formData.get('year')));
  const quarter = Number(str(formData.get('quarter')));
  const field = str(formData.get('field'));
  if (!Number.isInteger(year) || quarter < 1 || quarter > 4 || !field) return;

  const data: Record<string, any> = {};
  if (field === 'gstReceived') {
    const on = str(formData.get('value')) === '1';
    data.gstReceived = on;
    data.gstReceivedAt = on ? new Date() : null;
  } else if (field === 'qstReceived') {
    const on = str(formData.get('value')) === '1';
    data.qstReceived = on;
    data.qstReceivedAt = on ? new Date() : null;
  } else if (field === 'filingLink') {
    const link = str(formData.get('value'));
    data.filingLink = link;
    data.filedAt = link ? new Date() : null;
  } else if (field === 'incomeOverride') {
    const raw = str(formData.get('value'));
    const n = raw ? Number(raw) : NaN;
    data.incomeOverrideCad = raw && !Number.isNaN(n) ? n : null;
  } else {
    return;
  }

  await prisma.quarterlyFiling.upsert({
    where: { year_quarter: { year, quarter } },
    create: { year, quarter, ...data },
    update: data,
  });
  revalidatePath('/finance');
  redirect(`/finance?tab=tax&year=${year}`);
}

// ─── Statement archive ───────────────────────────────────────────────────────

const STATEMENT_TYPES = ['BANK', 'CREDIT_CARD'];
const MAX_STATEMENT_BYTES = 15 * 1024 * 1024; // 15 MB
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Best-effort "June 2026" period from a filename like "statement-2026-06.pdf".
function derivePeriodFromName(name: string): string | null {
  const s = name.toLowerCase();
  const yearM = s.match(/(19|20)\d{2}/);
  const year = yearM ? yearM[0] : null;
  let month = 0;
  for (let i = 0; i < 12; i++) if (new RegExp(`\\b${MONTH_ABBR[i]}`).test(s)) { month = i + 1; break; }
  if (!month) {
    const noYear = s.replace(/\b(19|20)\d{2}\b/g, ' ');
    const m = noYear.match(/\b(0?[1-9]|1[0-2])\b/);
    if (m) month = Number(m[1]);
  }
  if (month && year) return `${MONTH_FULL[month - 1]} ${year}`;
  if (year) return year;
  return null;
}

// Save one or more uploaded statement files into the archive (stored inline in
// the DB). Used by the standalone upload form (which allows multiple files) and,
// after an import, by the statement importer (source=IMPORT, one file).
export async function saveStatement(formData: FormData) {
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  const valid = files.filter((f) => f.size <= MAX_STATEMENT_BYTES);
  if (valid.length === 0) {
    throw new Error(files.length ? 'Those files are too large (max 15 MB each).' : 'Choose at least one statement file.');
  }

  const typeRaw = str(formData.get('accountType'));
  const accountType = STATEMENT_TYPES.includes(typeRaw ?? '') ? (typeRaw as string) : 'BANK';
  const accountLabel = str(formData.get('accountLabel'));
  const providedPeriod = str(formData.get('periodLabel'));
  const note = str(formData.get('note'));
  const source = str(formData.get('source')) === 'IMPORT' ? 'IMPORT' : 'UPLOAD';
  const importedExpenses = Number(str(formData.get('importedExpenses'))) || 0;
  const importedIncome = Number(str(formData.get('importedIncome'))) || 0;
  const session = await getSession();

  for (const file of valid) {
    const buffer = Buffer.from(await file.arrayBuffer());
    // With several files at once, prefer the period parsed from each filename so
    // months differ per statement; fall back to whatever was typed.
    const period = (valid.length > 1 ? derivePeriodFromName(file.name) : providedPeriod) || providedPeriod || derivePeriodFromName(file.name);
    await prisma.statement.create({
      data: {
        accountType,
        accountLabel: accountLabel || file.name,
        fileName: file.name,
        mimeType: file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : 'text/csv'),
        size: file.size,
        data: buffer,
        periodLabel: period,
        note,
        source,
        importedExpenses,
        importedIncome,
        uploadedById: session?.id ?? null,
      },
    });
  }
  revalidatePath('/statements');
}

export async function deleteStatement(id: string) {
  if (!id) return;
  await prisma.statement.delete({ where: { id } });
  revalidatePath('/statements');
}

// ─── Letters / documents (super-admin) ───────────────────────────────────────

async function requireSuperAdmin() {
  const s = await getSession();
  if (!s || !s.roles.includes('SUPER_ADMIN')) throw new Error('Not authorized.');
  return s;
}

const LETTER_TASK_STATUSES = ['TODO', 'DOING', 'DONE'];

export async function addLetterTask(letterId: string, title: string, detail: string | null, dueDate: string | null) {
  await requireSuperAdmin();
  const t = (title ?? '').trim();
  if (!letterId || !t) return;
  const max = await prisma.letterTask.aggregate({ where: { letterId, status: 'TODO' }, _max: { order: true } });
  await prisma.letterTask.create({
    data: {
      letterId,
      title: t.slice(0, 300),
      detail: detail?.trim() ? detail.trim().slice(0, 2000) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: 'TODO',
      order: (max._max.order ?? -1) + 1,
    },
  });
  revalidatePath(`/letters/${letterId}`);
}

export async function setLetterTaskStatus(taskId: string, status: string) {
  await requireSuperAdmin();
  if (!taskId || !LETTER_TASK_STATUSES.includes(status)) return;
  const t = await prisma.letterTask.update({ where: { id: taskId }, data: { status }, select: { letterId: true } });
  revalidatePath(`/letters/${t.letterId}`);
}

export async function updateLetterTask(
  taskId: string,
  patch: { title?: string; detail?: string | null; dueDate?: string | null },
) {
  await requireSuperAdmin();
  if (!taskId) return;
  const data: Record<string, any> = {};
  if (typeof patch.title === 'string') {
    const v = patch.title.trim();
    if (v) data.title = v.slice(0, 300);
  }
  if (patch.detail !== undefined) data.detail = patch.detail?.trim() ? patch.detail.trim().slice(0, 2000) : null;
  if (patch.dueDate !== undefined) data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
  if (Object.keys(data).length === 0) return;
  const t = await prisma.letterTask.update({ where: { id: taskId }, data, select: { letterId: true } });
  revalidatePath(`/letters/${t.letterId}`);
}

export async function deleteLetterTask(taskId: string) {
  await requireSuperAdmin();
  if (!taskId) return;
  const t = await prisma.letterTask.findUnique({ where: { id: taskId }, select: { letterId: true } });
  await prisma.letterTask.delete({ where: { id: taskId } });
  if (t) revalidatePath(`/letters/${t.letterId}`);
}

export async function reorderLetterTasks(
  letterId: string,
  updates: { id: string; status: string; order: number }[],
) {
  await requireSuperAdmin();
  if (!letterId || !Array.isArray(updates) || updates.length === 0) return;
  const valid = updates.filter(
    (u) => u && typeof u.id === 'string' && LETTER_TASK_STATUSES.includes(u.status) && Number.isFinite(u.order),
  );
  if (valid.length === 0) return;
  await prisma.$transaction(
    valid.map((u) =>
      prisma.letterTask.update({
        where: { id: u.id },
        data: { status: u.status, order: Math.trunc(u.order) },
      }),
    ),
  );
  revalidatePath(`/letters/${letterId}`);
}

export async function renameLetter(id: string, title: string) {
  await requireSuperAdmin();
  const t = (title ?? '').trim();
  if (!id || !t) return;
  await prisma.letter.update({ where: { id }, data: { title: t.slice(0, 200) } });
  revalidatePath(`/letters/${id}`);
}

export async function deleteLetter(id: string) {
  await requireSuperAdmin();
  if (!id) return;
  await prisma.letter.delete({ where: { id } });
  revalidatePath('/letters');
  redirect('/letters');
}

// ─── Letter task answers & attachments ───────────────────────────────────────

const ATTACH_MAX_BYTES = 15 * 1024 * 1024;

export async function setLetterTaskResponse(taskId: string, response: string | null) {
  await requireSuperAdmin();
  if (!taskId) return;
  const t = await prisma.letterTask.update({
    where: { id: taskId },
    data: { response: response?.trim() ? response.trim().slice(0, 8000) : null },
    select: { letterId: true },
  });
  revalidatePath(`/letters/${t.letterId}`);
}

// Attach a freshly uploaded file to a task (bytes stored inline).
export async function addTaskUpload(formData: FormData) {
  await requireSuperAdmin();
  const taskId = str(formData.get('taskId'));
  if (!taskId) return;
  const file = formData.get('file') as { arrayBuffer?: () => Promise<ArrayBuffer>; size?: number; name?: string; type?: string } | null;
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) return;
  if (file.size > ATTACH_MAX_BYTES) throw new Error('File too large (max 15 MB).');
  const buf = Buffer.from(await file.arrayBuffer());
  const task = await prisma.letterTask.findUnique({ where: { id: taskId }, select: { letterId: true } });
  if (!task) return;
  await prisma.taskAttachment.create({
    data: {
      taskId,
      kind: 'UPLOAD',
      fileName: (typeof file.name === 'string' && file.name ? file.name : 'attachment').slice(0, 260),
      mimeType: (typeof file.type === 'string' && file.type ? file.type : 'application/octet-stream').slice(0, 120),
      size: file.size,
      data: buf,
    },
  });
  revalidatePath(`/letters/${task.letterId}`);
}

// Attach an already-archived Statement to a task (reference, no re-upload).
export async function attachStatementToTask(taskId: string, statementId: string) {
  await requireSuperAdmin();
  if (!taskId || !statementId) return;
  const [task, stmt] = await Promise.all([
    prisma.letterTask.findUnique({ where: { id: taskId }, select: { letterId: true } }),
    prisma.statement.findUnique({ where: { id: statementId }, select: { id: true, fileName: true, mimeType: true, size: true } }),
  ]);
  if (!task || !stmt) return;
  await prisma.taskAttachment.create({
    data: {
      taskId,
      kind: 'STATEMENT',
      statementId: stmt.id,
      fileName: stmt.fileName.slice(0, 260),
      mimeType: stmt.mimeType,
      size: stmt.size,
    },
  });
  revalidatePath(`/letters/${task.letterId}`);
}

// Attach several archived statements to a task at once.
export async function attachStatementsToTask(taskId: string, statementIds: string[]) {
  await requireSuperAdmin();
  if (!taskId) return;
  const ids = Array.from(new Set((statementIds ?? []).filter(Boolean)));
  if (ids.length === 0) return;
  const [task, stmts] = await Promise.all([
    prisma.letterTask.findUnique({ where: { id: taskId }, select: { letterId: true } }),
    prisma.statement.findMany({ where: { id: { in: ids } }, select: { id: true, fileName: true, mimeType: true, size: true } }),
  ]);
  if (!task || stmts.length === 0) return;
  await prisma.taskAttachment.createMany({
    data: stmts.map((s) => ({ taskId, kind: 'STATEMENT', statementId: s.id, fileName: s.fileName.slice(0, 260), mimeType: s.mimeType, size: s.size })),
  });
  revalidatePath(`/letters/${task.letterId}`);
}

export async function removeTaskAttachment(attachmentId: string) {
  await requireSuperAdmin();
  if (!attachmentId) return;
  const a = await prisma.taskAttachment.findUnique({ where: { id: attachmentId }, select: { task: { select: { letterId: true } } } });
  await prisma.taskAttachment.delete({ where: { id: attachmentId } });
  if (a?.task) revalidatePath(`/letters/${a.task.letterId}`);
}

const prettifyCat = (c: string) => c.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

// Generate a finance report (PDF + CSV) from imported transactions in a date
// range, and attach both to a letter task so they flow into the submission PDF.
export async function generateFinanceReport(
  taskId: string,
  opts: { type: ReportType; from?: string | null; to?: string | null; topN?: number },
) {
  await requireSuperAdmin();
  if (!taskId || !opts?.type || !REPORT_LABELS[opts.type]) return;
  const task = await prisma.letterTask.findUnique({ where: { id: taskId }, select: { letterId: true } });
  if (!task) return;

  // Accept YYYY-MM (month) or YYYY-MM-DD; the end bound is exclusive so a whole
  // month/quarter is fully included.
  const parseYm = (s: string | null | undefined, end: boolean): Date | null => {
    if (!s) return null;
    const m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = m[3] ? Number(m[3]) : null;
    if (!end) return new Date(Date.UTC(y, mo - 1, d ?? 1));
    return d ? new Date(Date.UTC(y, mo - 1, d + 1)) : new Date(Date.UTC(y, mo, 1)); // exclusive
  };
  const from = parseYm(opts.from, false);
  const toExcl = parseYm(opts.to, true);
  const bound = (field: string) =>
    from || toExcl ? { [field]: { ...(from ? { gte: from } : {}), ...(toExcl ? { lt: toExcl } : {}) } } : {};

  const [rates, company, expenses, payments, otherIncome] = await Promise.all([
    getRatesToCad(),
    getCompany(),
    prisma.expense.findMany({ where: bound('date'), orderBy: { date: 'asc' } }),
    prisma.payment.findMany({ where: bound('paidAt'), orderBy: { paidAt: 'asc' }, include: { client: { select: { name: true } } } }),
    prisma.otherIncome.findMany({ where: bound('date'), orderBy: { date: 'asc' } }),
  ]);

  const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
  const cad = (amt: number, cur: string, amtCad: number | null) => amtCad ?? toCad(amt, cur, rates);
  const expLabel = (c: string) => EXPENSE_CATEGORY_LABELS[c] ?? prettifyCat(c);
  const incLabel = (c: string) => INCOME_CATEGORY_LABELS[c] ?? prettifyCat(c);

  const entries: LedgerEntry[] = [
    ...expenses.map((e) => ({ date: iso(e.date), kind: 'expense' as const, description: e.title, party: expLabel(e.category), amountCad: cad(e.amount, e.currency, e.amountCad), gst: e.gst ?? 0, qst: e.qst ?? 0 })),
    ...payments.map((p) => ({ date: iso(p.paidAt), kind: 'income' as const, description: p.note?.trim() || 'Client payment', party: p.client?.name || 'Client', amountCad: cad(p.amount, p.currency, p.amountCad), gst: p.gst ?? 0, qst: p.qst ?? 0 })),
    ...otherIncome.map((o) => ({ date: iso(o.date), kind: 'income' as const, description: o.title, party: incLabel(o.category), amountCad: cad(o.amount, o.currency, o.amountCad), gst: o.gst ?? 0, qst: o.qst ?? 0 })),
  ];

  const report = buildReport(opts.type, entries, { topN: opts.topN });

  // A tidy label/stamp: whole-quarter ranges read as "Q1 2026".
  let periodLabel = 'All imported transactions';
  let stamp = 'all';
  if (opts.from && opts.to) {
    const [fy, fm] = opts.from.split('-').map(Number);
    const [ty, tm] = opts.to.split('-').map(Number);
    if (fy === ty && [1, 4, 7, 10].includes(fm) && tm === fm + 2) {
      const q = (fm - 1) / 3 + 1;
      periodLabel = `Q${q} ${fy}`;
      stamp = `Q${q}-${fy}`;
    } else {
      periodLabel = `${opts.from} to ${opts.to}`;
      stamp = `${opts.from}_${opts.to}`;
    }
  } else if (opts.from) { periodLabel = `From ${opts.from}`; stamp = opts.from; }
  else if (opts.to) { periodLabel = `Until ${opts.to}`; stamp = opts.to; }

  const pdf = await renderReportPdf(report, { company, periodLabel });
  const csv = reportToCsv(report);
  const csvBuf = Buffer.from(csv, 'utf8');
  const pdfBuf = Buffer.from(pdf);

  const base = `${REPORT_LABELS[opts.type]} ${stamp}`.replace(/[^\w.\- ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);

  // Shared key + spec on the PDF/CSV pair so they can be regenerated live.
  const reportKey = randomUUID();
  const reportSpec = { type: opts.type, from: opts.from ?? null, to: opts.to ?? null, topN: opts.topN ?? null };
  await prisma.taskAttachment.create({ data: { taskId, kind: 'UPLOAD', fileName: `${base}.pdf`, mimeType: 'application/pdf', size: pdfBuf.length, data: pdfBuf, reportKey, reportSpec } });
  await prisma.taskAttachment.create({ data: { taskId, kind: 'UPLOAD', fileName: `${base}.csv`, mimeType: 'text/csv', size: csvBuf.length, data: csvBuf, reportKey, reportSpec } });
  revalidatePath(`/letters/${task.letterId}`);
}

// Regenerate a previously-attached finance report with the latest data: delete
// the old PDF/CSV pair and re-run it with the same parameters.
export async function regenerateReport(reportKey: string) {
  await requireSuperAdmin();
  if (!reportKey) return;
  const atts = await prisma.taskAttachment.findMany({ where: { reportKey }, select: { taskId: true, reportSpec: true } });
  if (atts.length === 0) return;
  const spec = atts[0].reportSpec as { type?: ReportType; from?: string | null; to?: string | null; topN?: number | null } | null;
  const taskId = atts[0].taskId;
  await prisma.taskAttachment.deleteMany({ where: { reportKey } });
  if (spec?.type) {
    await generateFinanceReport(taskId, { type: spec.type, from: spec.from ?? null, to: spec.to ?? null, topN: spec.topN ?? undefined });
  }
}

// ─── Loans / money to recover ────────────────────────────────────────────────

export async function addLoan(formData: FormData) {
  const counterparty = str(formData.get('counterparty'));
  if (!counterparty) throw new Error('Who received the money is required.');

  const amountRaw = str(formData.get('amount'));
  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    throw new Error('A valid amount is required.');
  }

  const currency = str(formData.get('currency')) ?? 'CAD';
  const givenRaw = str(formData.get('givenAt'));
  const rates = await getRatesToCad();
  const amountCad = toCad(amount, currency, rates);

  // An optional opening "already recovered" amount (e.g. for back-dated loans).
  const recoveredRaw = str(formData.get('recoveredAmount'));
  const recovered = recoveredRaw ? Number(recoveredRaw) : 0;

  await prisma.loan.create({
    data: {
      counterparty,
      note: str(formData.get('note')),
      amount,
      currency,
      amountCad,
      recoveredAmount: !Number.isNaN(recovered) && recovered > 0 ? recovered : 0,
      givenAt: givenRaw ? new Date(givenRaw) : new Date(),
    },
  });

  revalidatePath('/finance');
  redirect('/finance?tab=loans');
}

// Record a (partial) recovery against a loan. Amount is taken in CAD.
export async function recordLoanRecovery(formData: FormData) {
  const id = str(formData.get('loanId'));
  if (!id) return;
  const amountRaw = str(formData.get('amount'));
  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) return;

  const loan = await prisma.loan.findUnique({ where: { id }, select: { amountCad: true, recoveredAmount: true } });
  if (!loan) return;
  const cap = loan.amountCad ?? Infinity;
  const next = Math.min(loan.recoveredAmount + amount, cap);

  await prisma.loan.update({ where: { id }, data: { recoveredAmount: next } });
  revalidatePath('/finance');
}

export async function deleteLoan(id: string) {
  if (!id) return;
  await prisma.loan.delete({ where: { id } });
  revalidatePath('/finance');
}

// ─── Assistant ───────────────────────────────────────────────────────────────

// Clears the signed-in user's own saved assistant chat history.
export async function clearAssistantHistory() {
  const s = await getSession();
  if (!s) return;
  await prisma.assistantMessage.deleteMany({ where: { userId: s.id } });
  revalidatePath('/assistant');
  redirect('/assistant');
}

// ─── Logins vault ────────────────────────────────────────────────────────────

async function loginAccess() {
  const s = await getSession();
  return { s, manage: canManageLogins(s?.roles) };
}

export async function createLogin(formData: FormData) {
  const { s, manage } = await loginAccess();
  if (!s || !manage) return;
  const name = str(formData.get('name'));
  if (!name) return;
  const shareUserIds = formData.getAll('shareUserIds').map(String).filter(Boolean);
  const created = await prisma.login.create({
    data: {
      name,
      url: str(formData.get('url')),
      username: str(formData.get('username')),
      notes: str(formData.get('notes')),
      passwordEnc: encryptSecret(str(formData.get('password')) ?? ''),
      createdById: s.id,
      shares: shareUserIds.length ? { create: shareUserIds.map((userId) => ({ userId })) } : undefined,
    },
  });
  await notifyUsers(
    shareUserIds.filter((id) => id !== s.id),
    { type: 'login_shared', title: 'A login was shared with you', body: name, href: `/logins?focus=${created.id}` },
  );
  revalidatePath('/logins');
}

export async function updateLogin(formData: FormData) {
  const { s, manage } = await loginAccess();
  if (!s || !manage) return;
  const id = str(formData.get('id'));
  const name = str(formData.get('name'));
  if (!id || !name) return;
  const password = str(formData.get('password'));
  const data: Record<string, unknown> = {
    name,
    url: str(formData.get('url')),
    username: str(formData.get('username')),
    notes: str(formData.get('notes')),
  };
  if (password) data.passwordEnc = encryptSecret(password); // only rotate if a new one was typed
  await prisma.login.update({ where: { id }, data });

  const shareUserIds = formData.getAll('shareUserIds').map(String).filter(Boolean);
  const prior = await prisma.loginShare.findMany({ where: { loginId: id }, select: { userId: true } });
  const priorIds = new Set(prior.map((p) => p.userId));
  await prisma.loginShare.deleteMany({ where: { loginId: id } });
  if (shareUserIds.length) {
    await prisma.loginShare.createMany({
      data: shareUserIds.map((userId) => ({ loginId: id, userId })),
      skipDuplicates: true,
    });
  }
  // Notify only people newly granted access.
  await notifyUsers(
    shareUserIds.filter((uid) => !priorIds.has(uid) && uid !== s.id),
    { type: 'login_shared', title: 'A login was shared with you', body: name, href: `/logins?focus=${id}` },
  );
  revalidatePath('/logins');
}

export async function deleteLogin(formData: FormData) {
  const { s, manage } = await loginAccess();
  if (!s || !manage) return;
  const id = str(formData.get('id'));
  if (!id) return;
  await prisma.login.delete({ where: { id } });
  revalidatePath('/logins');
}

export async function revokeLoginShare(loginId: string, userId: string) {
  const { s, manage } = await loginAccess();
  if (!s || !manage || !loginId || !userId) return;
  await prisma.loginShare.deleteMany({ where: { loginId, userId } });
  revalidatePath('/logins');
}

// Returns the decrypted password — only to a user allowed to see this login.
export async function revealLogin(id: string): Promise<string> {
  const { s, manage } = await loginAccess();
  if (!s || !id) return '';
  const login = await prisma.login.findUnique({
    where: { id },
    select: { passwordEnc: true, createdById: true, shares: { select: { userId: true } } },
  });
  if (!login) return '';
  const allowed = manage || login.createdById === s.id || login.shares.some((sh) => sh.userId === s.id);
  if (!allowed) return '';
  return decryptSecret(login.passwordEnc);
}

// ─── Comment threads (Figma-style) ───────────────────────────────────────────

async function notifyCommentTargets(opts: {
  threadId: string;
  body: string;
  href: string;
  actorId: string;
  actorName: string;
  isReply: boolean;
}) {
  try {
    const mentioned = await resolveMentions(opts.body);
    // Reply: also notify everyone else who has commented in the thread.
    let participants: string[] = [];
    if (opts.isReply) {
      const rows = await prisma.comment.findMany({ where: { threadId: opts.threadId }, select: { authorId: true } });
      participants = rows.map((r) => r.authorId).filter((id): id is string => !!id);
    }
    const targets = Array.from(new Set([...mentioned, ...participants])).filter((id) => id !== opts.actorId);
    await notifyUsers(targets, {
      type: 'mention',
      title: opts.isReply ? `${opts.actorName} replied` : `${opts.actorName} commented`,
      body: opts.body.slice(0, 160),
      href: opts.href,
    });
  } catch {
    /* best-effort */
  }
}

export async function createCommentThread(entityType: string, entityId: string, body: string, href: string) {
  const s = await getSession();
  const text = body.trim();
  if (!s || !entityType || !entityId || !text) return;
  const thread = await prisma.commentThread.create({
    data: {
      entityType,
      entityId,
      createdById: s.id,
      comments: { create: { authorId: s.id, body: text.slice(0, 4000) } },
    },
  });
  await notifyCommentTargets({ threadId: thread.id, body: text, href, actorId: s.id, actorName: s.name, isReply: false });
}

export async function replyToThread(threadId: string, body: string, href: string) {
  const s = await getSession();
  const text = body.trim();
  if (!s || !threadId || !text) return;
  await prisma.comment.create({ data: { threadId, authorId: s.id, body: text.slice(0, 4000) } });
  await prisma.commentThread.update({ where: { id: threadId }, data: { updatedAt: new Date(), resolved: false } });
  await notifyCommentTargets({ threadId, body: text, href, actorId: s.id, actorName: s.name, isReply: true });
}

export async function resolveThread(threadId: string, resolved: boolean) {
  const s = await getSession();
  if (!s || !threadId) return;
  await prisma.commentThread.update({ where: { id: threadId }, data: { resolved } });
}

export async function deleteCommentThread(threadId: string) {
  const s = await getSession();
  if (!s || !threadId) return;
  const thread = await prisma.commentThread.findUnique({ where: { id: threadId }, select: { createdById: true } });
  const isAdmin = s.roles?.some((r) => r === 'SUPER_ADMIN' || r === 'MANAGER');
  if (!thread || (thread.createdById !== s.id && !isAdmin)) return;
  await prisma.commentThread.delete({ where: { id: threadId } });
}

// ─── Messaging ───────────────────────────────────────────────────────────────

// Create a conversation, or reuse an existing 1:1 DM between the two people.
export async function createConversation(
  memberIds: string[],
  isGroup: boolean,
  title?: string,
): Promise<{ id: string } | null> {
  const s = await getSession();
  if (!s) return null;
  const others = Array.from(new Set(memberIds.filter((id) => id && id !== s.id)));
  if (!others.length) return null;

  if (!isGroup && others.length === 1) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [{ members: { some: { userId: s.id } } }, { members: { some: { userId: others[0] } } }],
      },
      include: { _count: { select: { members: true } } },
    });
    if (existing && existing._count.members === 2) return { id: existing.id };
  }

  const allIds = Array.from(new Set([s.id, ...others]));
  const convo = await prisma.conversation.create({
    data: {
      isGroup: isGroup || allIds.length > 2,
      title: isGroup ? title?.trim() || null : null,
      createdById: s.id,
      members: { create: allIds.map((userId) => ({ userId, lastReadAt: userId === s.id ? new Date() : null })) },
    },
  });
  return { id: convo.id };
}

type Attachment = { url?: string | null; name?: string | null; type?: string | null };

export async function sendMessage(
  conversationId: string,
  body: string,
  attachment?: Attachment,
): Promise<{ ok: boolean }> {
  const s = await getSession();
  const text = (body ?? '').trim();
  const hasAttachment = !!attachment?.url;
  if (!s || !conversationId || (!text && !hasAttachment)) return { ok: false };
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: s.id } },
  });
  if (!member) return { ok: false };
  await prisma.message.create({
    data: {
      conversationId,
      senderId: s.id,
      body: text.slice(0, 4000),
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      attachmentType: attachment?.type ?? null,
    },
  });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: s.id } },
    data: { lastReadAt: new Date(), deletedAt: null },
  });
  // A new message brings the conversation back for anyone who had deleted it.
  await prisma.conversationMember.updateMany({ where: { conversationId, deletedAt: { not: null } }, data: { deletedAt: null } });

  // Notify the other members — one rolling, unread notification per conversation
  // (bumped rather than duplicated) so the bell doesn't flood on chatty threads.
  try {
    const convo = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { isGroup: true, title: true } });
    const others = await prisma.conversationMember.findMany({ where: { conversationId, userId: { not: s.id } }, select: { userId: true } });
    const href = `/messages?c=${conversationId}`;
    const title = convo?.isGroup ? `${s.name} in ${convo.title || 'a group'}` : `New message from ${s.name}`;
    const snippet = (text || `📎 ${attachment?.name ?? 'Attachment'}`).slice(0, 140);
    for (const m of others) {
      const existing = await prisma.notification.findFirst({ where: { userId: m.userId, type: 'message', href, read: false }, select: { id: true } });
      if (existing) {
        await prisma.notification.update({ where: { id: existing.id }, data: { title, body: snippet, createdAt: new Date() } });
      } else {
        await prisma.notification.create({ data: { userId: m.userId, type: 'message', title, body: snippet, href } });
      }
    }
  } catch {
    /* best-effort */
  }

  return { ok: true };
}

// Soft-delete a conversation for the current user — it moves to "Recently
// deleted" and is kept for 30 days (lazy-purged when the list is loaded).
export async function deleteConversation(conversationId: string) {
  const s = await getSession();
  if (!s || !conversationId) return;
  await prisma.conversationMember.updateMany({
    where: { conversationId, userId: s.id },
    data: { deletedAt: new Date(), lastReadAt: new Date() },
  });
}

// Restore a soft-deleted conversation back to the active list.
export async function restoreConversation(conversationId: string) {
  const s = await getSession();
  if (!s || !conversationId) return;
  await prisma.conversationMember.updateMany({
    where: { conversationId, userId: s.id },
    data: { deletedAt: null },
  });
}

// Mark a conversation read or unread for the current user.
export async function setConversationRead(conversationId: string, read: boolean) {
  const s = await getSession();
  if (!s || !conversationId) return;
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: s.id } },
    select: { id: true },
  });
  if (!member) return;
  if (read) {
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: s.id } },
      data: { lastReadAt: new Date() },
    });
    await prisma.notification.updateMany({
      where: { userId: s.id, type: 'message', href: `/messages?c=${conversationId}`, read: false },
      data: { read: true },
    });
  } else {
    // Mark unread: rewind read marker to just before the latest message.
    const last = await prisma.message.findFirst({ where: { conversationId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: s.id } },
      data: { lastReadAt: last ? new Date(last.createdAt.getTime() - 1000) : null },
    });
  }
}

// ─── Database maintenance (super admin) ──────────────────────────────────────

// Applies any pending Prisma migrations (`prisma migrate deploy`) on demand, so
// a schema change can be activated without waiting for a redeploy. Only applies
// already-committed migrations — never resets or generates. Super-admin only.
export async function runMigrations(): Promise<{ ok: boolean; output: string }> {
  const s = await getSession();
  if (!s?.roles?.includes('SUPER_ADMIN')) return { ok: false, output: 'Not authorized — super admin only.' };
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const run = promisify(execFile);
    const { stdout, stderr } = await run(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { cwd: process.cwd(), env: process.env, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
    );
    const out = `${stdout}\n${stderr}`.trim();
    return { ok: true, output: out.slice(-4000) || 'No pending migrations — database is up to date.' };
  } catch (e: any) {
    const out = `${e?.stdout ?? ''}\n${e?.stderr ?? ''}\n${e?.message ?? ''}`.trim();
    return { ok: false, output: out.slice(-4000) || 'Migration failed.' };
  }
}

// ─── Attendance (check in / out) & leave ─────────────────────────────────────

const ATTENDANCE_ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER'];
const LEAVE_TYPES = ['VACATION', 'SICK', 'ABSENT', 'UNPAID', 'OTHER'];

function isAttendanceAdmin(s: { roles?: string[] } | null) {
  return !!s?.roles?.some((r) => ATTENDANCE_ADMIN_ROLES.includes(r));
}

export async function checkIn() {
  const s = await getSession();
  if (!s) return;
  const open = await prisma.timeEntry.findFirst({ where: { userId: s.id, checkOutAt: null } });
  if (open) return; // already checked in
  await prisma.timeEntry.create({ data: { userId: s.id, checkInAt: new Date(), source: 'SELF' } });
  revalidatePath('/time');
}

// Builds the "tasks done" draft from task activity since the open check-in.
export async function getCheckoutTasks(): Promise<string> {
  const s = await getSession();
  if (!s) return '';
  const open = await prisma.timeEntry.findFirst({
    where: { userId: s.id, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
  });
  if (!open) return '';
  const acts = await prisma.taskActivity.findMany({
    where: { userId: s.id, createdAt: { gte: open.checkInAt } },
    orderBy: { createdAt: 'asc' },
  });
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const a of acts) {
    if (!seen.has(a.summary)) {
      seen.add(a.summary);
      lines.push(`• ${a.summary}`);
    }
  }
  return lines.join('\n');
}

// Interactive checkout: the distinct tasks the user actually touched since
// check-in, each with its *current* board status (not a replay of every move).
// The UI shows these as a checklist so the person confirms what they finished.
export async function getCheckoutTasksDetailed(): Promise<
  { taskId: string; title: string; project: string | null; status: string }[]
> {
  const s = await getSession();
  if (!s) return [];
  const open = await prisma.timeEntry.findFirst({
    where: { userId: s.id, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
  });
  if (!open) return [];
  const acts = await prisma.taskActivity.findMany({
    where: { userId: s.id, createdAt: { gte: open.checkInAt }, taskId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { taskId: true },
  });
  // Distinct task ids, preserving first-touched order.
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const a of acts) {
    if (a.taskId && !seen.has(a.taskId)) {
      seen.add(a.taskId);
      ids.push(a.taskId);
    }
  }
  if (!ids.length) return [];
  const tasks = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, status: true, project: { select: { name: true } } },
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return tasks
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((t) => ({ taskId: t.id, title: t.title, project: t.project?.name ?? null, status: t.status }));
}

// Current user's open-session status, for the header quick button.
export async function attendanceStatus(): Promise<{ open: boolean; checkInAt: string | null }> {
  const s = await getSession();
  if (!s) return { open: false, checkInAt: null };
  const open = await prisma.timeEntry.findFirst({
    where: { userId: s.id, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
  });
  return { open: !!open, checkInAt: open ? open.checkInAt.toISOString() : null };
}

// One-click checkout from the header — auto-fills tasks done from activity.
export async function quickCheckOut() {
  const s = await getSession();
  if (!s) return;
  const open = await prisma.timeEntry.findFirst({
    where: { userId: s.id, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
  });
  if (!open) return;
  const now = new Date();
  const hours = Math.max(0, (now.getTime() - open.checkInAt.getTime()) / 3_600_000);
  const acts = await prisma.taskActivity.findMany({
    where: { userId: s.id, createdAt: { gte: open.checkInAt } },
    orderBy: { createdAt: 'asc' },
  });
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const a of acts) {
    if (!seen.has(a.summary)) {
      seen.add(a.summary);
      lines.push(`• ${a.summary}`);
    }
  }
  await prisma.timeEntry.update({
    where: { id: open.id },
    data: { checkOutAt: now, hours: Math.round(hours * 100) / 100, tasks: lines.join('\n') },
  });
  revalidatePath('/time');
  revalidatePath('/time/report');
}

// Activity heartbeat: adds non-idle seconds to the open session. Sent ~every
// minute by the client while the user is actually interacting. No revalidate —
// must not churn the UI.
export async function recordActivity(seconds: number) {
  const s = await getSession();
  if (!s) return;
  const inc = Math.min(Math.max(Math.round(seconds || 0), 0), 120); // clamp to a sane beat
  if (!inc) return;
  const open = await prisma.timeEntry.findFirst({
    where: { userId: s.id, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
    select: { id: true },
  });
  if (!open) return;
  await prisma.timeEntry.update({ where: { id: open.id }, data: { activeSeconds: { increment: inc } } });
}

export async function checkOut(formData: FormData) {
  const s = await getSession();
  if (!s) return;
  const open = await prisma.timeEntry.findFirst({
    where: { userId: s.id, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
  });
  if (!open) return;
  const now = new Date();
  const hours = Math.max(0, (now.getTime() - open.checkInAt.getTime()) / 3_600_000);
  await prisma.timeEntry.update({
    where: { id: open.id },
    data: {
      checkOutAt: now,
      hours: Math.round(hours * 100) / 100,
      tasks: str(formData.get('tasks')),
      notes: str(formData.get('notes')),
    },
  });
  revalidatePath('/time');
  revalidatePath('/time/report');
}

export async function requestLeave(formData: FormData) {
  const s = await getSession();
  if (!s) return;
  const type = LEAVE_TYPES.includes(str(formData.get('type')) ?? '') ? (str(formData.get('type')) as string) : 'VACATION';
  const startRaw = str(formData.get('startDate'));
  if (!startRaw) throw new Error('Start date is required.');
  const endRaw = str(formData.get('endDate')) || startRaw;
  await prisma.leaveRequest.create({
    data: {
      userId: s.id,
      type,
      startDate: new Date(startRaw),
      endDate: new Date(endRaw),
      reason: str(formData.get('reason')),
      status: 'PENDING',
      createdById: s.id,
    },
  });
  // Notify attendance admins (super admin / manager) of the new request.
  const admins = await prisma.user.findMany({
    where: { roles: { hasSome: ATTENDANCE_ADMIN_ROLES as any } },
    select: { id: true },
  });
  await notifyUsers(
    admins.map((a) => a.id).filter((id) => id !== s.id),
    {
      type: 'leave',
      title: `Leave request from ${s.name}`,
      body: `${type}${endRaw && endRaw !== startRaw ? ` · ${startRaw} → ${endRaw}` : ` · ${startRaw}`}`,
      href: '/time/report',
    },
  );
  revalidatePath('/time');
  revalidatePath('/time/report');
}

export async function decideLeave(id: string, decision: 'APPROVED' | 'REJECTED') {
  const s = await getSession();
  if (!isAttendanceAdmin(s) || !id || !['APPROVED', 'REJECTED'].includes(decision)) return;
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: decision, decidedById: s!.id, decidedAt: new Date() },
  });
  revalidatePath('/time');
  revalidatePath('/time/report');
}

// Admin: record an absence (or any leave) directly, already approved.
export async function addAbsence(formData: FormData) {
  const s = await getSession();
  if (!isAttendanceAdmin(s)) return;
  const userId = str(formData.get('userId'));
  if (!userId) return;
  const type = LEAVE_TYPES.includes(str(formData.get('type')) ?? '') ? (str(formData.get('type')) as string) : 'ABSENT';
  const startRaw = str(formData.get('startDate'));
  if (!startRaw) return;
  const endRaw = str(formData.get('endDate')) || startRaw;
  await prisma.leaveRequest.create({
    data: {
      userId,
      type,
      startDate: new Date(startRaw),
      endDate: new Date(endRaw),
      reason: str(formData.get('reason')),
      status: 'APPROVED',
      createdById: s!.id,
      decidedById: s!.id,
      decidedAt: new Date(),
    },
  });
  revalidatePath('/time/report');
  revalidatePath('/time');
}

export async function deleteLeave(id: string) {
  const s = await getSession();
  if (!s || !id) return;
  const lr = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!lr) return;
  // Admins can delete any; members can cancel their own pending request.
  if (!isAttendanceAdmin(s) && !(lr.userId === s.id && lr.status === 'PENDING')) return;
  await prisma.leaveRequest.delete({ where: { id } });
  revalidatePath('/time');
  revalidatePath('/time/report');
}

// Edit a session's times / tasks / notes. Owner can edit their own; admins any.
// checkInAt / checkOutAt arrive as ISO strings (converted to UTC on the client).
export async function updateTimeEntry(formData: FormData) {
  const s = await getSession();
  if (!s) return;
  const id = str(formData.get('id'));
  if (!id) return;
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) return;
  if (!isAttendanceAdmin(s) && entry.userId !== s.id) return;

  const inRaw = str(formData.get('checkInAt'));
  const outRaw = str(formData.get('checkOutAt'));
  const checkInAt = inRaw ? new Date(inRaw) : entry.checkInAt;
  const checkOutAt = outRaw ? new Date(outRaw) : null;
  if (Number.isNaN(checkInAt.getTime())) return;

  let hours: number | null = null;
  if (checkOutAt && !Number.isNaN(checkOutAt.getTime())) {
    hours = Math.max(0, Math.round(((checkOutAt.getTime() - checkInAt.getTime()) / 3_600_000) * 100) / 100);
  }

  await prisma.timeEntry.update({
    where: { id },
    data: {
      checkInAt,
      checkOutAt: checkOutAt && !Number.isNaN(checkOutAt.getTime()) ? checkOutAt : null,
      hours,
      tasks: str(formData.get('tasks')),
      notes: str(formData.get('notes')),
    },
  });
  revalidatePath('/time');
  revalidatePath('/time/report');
  redirect(str(formData.get('from')) || '/time');
}

// Admin: remove a logged session (e.g. a mistaken check-in).
export async function deleteTimeEntry(id: string) {
  const s = await getSession();
  if (!isAttendanceAdmin(s) || !id) return;
  await prisma.timeEntry.delete({ where: { id } });
  revalidatePath('/time');
  revalidatePath('/time/report');
}
