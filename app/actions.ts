'use server';

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
  EXPENSE_CATEGORIES,
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
import { getSession } from '@/lib/auth';
import { driveConfigured, uploadToDrive, testDriveConnection } from '@/lib/drive';
import { testOpenRouter } from '@/lib/integrations';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { notifyUsers, resolveMentions } from '@/lib/notify';

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? '').toString().trim();
  return s.length ? s : null;
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
    },
  });
  await logActivity(`Recorded a payment of ${amount} ${currency}`);

  revalidatePath(`/clients/${clientId}`);
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

  await prisma.expense.create({
    data: {
      title,
      category,
      amount,
      currency,
      amountCad,
      fxRate,
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

const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PAID', 'VOID'];

export async function setInvoiceStatus(formData: FormData) {
  const id = str(formData.get('invoiceId'));
  const status = str(formData.get('status'));
  if (!id || !INVOICE_STATUSES.includes(status ?? '')) return;
  await prisma.invoice.update({ where: { id }, data: { status: status as any } });
  revalidatePath(`/invoices/${id}`);
  revalidatePath('/invoices');
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
    default:
      return { ok: false, message: 'Nothing to test for this integration.' };
  }
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
  const p = await prisma.payment.findUnique({ where: { id }, select: { clientId: true } });
  await prisma.payment.delete({ where: { id } });
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
// whose description reads as interest is relabelled "Additional credit card fee".
export async function importStatementExpenses(items: ImportItem[]): Promise<{ count: number }> {
  if (!Array.isArray(items) || items.length === 0) return { count: 0 };

  const rates = await getRatesToCad();
  const data = items
    .map((it) => {
      const amount = typeof it.amount === 'string' ? Number(it.amount) : it.amount ?? 0;
      if (!amount || Number.isNaN(amount) || amount <= 0) return null;

      let title = (it.title ?? '').trim() || 'Expense';
      let category = EXPENSE_CATEGORIES.includes(it.category ?? '') ? (it.category as string) : 'OTHER';
      // The interest → fee rule, enforced server-side regardless of the client.
      if (/interest/i.test(title)) {
        title = 'Additional credit card fee';
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

export async function sendMessage(conversationId: string, body: string): Promise<{ ok: boolean }> {
  const s = await getSession();
  const text = body.trim();
  if (!s || !conversationId || !text) return { ok: false };
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: s.id } },
  });
  if (!member) return { ok: false };
  await prisma.message.create({ data: { conversationId, senderId: s.id, body: text.slice(0, 4000) } });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: s.id } },
    data: { lastReadAt: new Date() },
  });

  // Notify the other members — one rolling, unread notification per conversation
  // (bumped rather than duplicated) so the bell doesn't flood on chatty threads.
  try {
    const convo = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { isGroup: true, title: true } });
    const others = await prisma.conversationMember.findMany({ where: { conversationId, userId: { not: s.id } }, select: { userId: true } });
    const href = `/messages?c=${conversationId}`;
    const title = convo?.isGroup ? `${s.name} in ${convo.title || 'a group'}` : `New message from ${s.name}`;
    const snippet = text.slice(0, 140);
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

// Leave/delete a conversation. Removes it for everyone (small-team behaviour);
// any member may delete. Cascades messages + memberships.
export async function deleteConversation(conversationId: string) {
  const s = await getSession();
  if (!s || !conversationId) return;
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: s.id } },
    select: { id: true },
  });
  if (!member) return;
  await prisma.conversation.delete({ where: { id: conversationId } });
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
