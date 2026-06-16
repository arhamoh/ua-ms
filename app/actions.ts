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
  LEAD_TYPES,
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_LABELS,
  FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
} from '@/lib/enums';
import { getRatesToCad, toCad } from '@/lib/fx';
import { sendEmail } from '@/lib/email';
import { invoiceHtml, receiptHtml } from '@/lib/documents';
import { getSession } from '@/lib/auth';
import { driveConfigured, uploadToDrive } from '@/lib/drive';

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
      salespersonId: salespersonId || null,
      projects: { create: buildProjectData(formData) },
    },
    include: { projects: true },
  });

  await autoInvoice(client.id, client.projects[0]);

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

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

// ─── Tasks (project board) ───────────────────────────────────────────────────

export async function createTask(projectId: string, title: string, status: string) {
  const t = title.trim();
  if (!projectId || !t) return;
  await prisma.task.create({
    data: {
      projectId,
      title: t,
      status: TASK_STATUSES.includes(status) ? (status as any) : 'TODO',
    },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function moveTask(taskId: string, status: string, projectId: string) {
  if (!taskId || !TASK_STATUSES.includes(status)) return;
  await prisma.task.update({ where: { id: taskId }, data: { status: status as any } });
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
  const tagNames = Array.from(
    new Set(data.tags.map((s) => s.trim()).filter(Boolean)),
  ).slice(0, 12);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description: data.description.trim() || null,
      status: TASK_STATUSES.includes(data.status) ? (data.status as any) : 'TODO',
      priority: PRIORITIES.includes(data.priority) ? (data.priority as any) : 'MEDIUM',
      assigneeId: data.assigneeId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      tags: {
        set: [],
        connectOrCreate: tagNames.map((name) => ({ where: { name }, create: { name } })),
      },
    },
  });
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
    },
  });

  revalidatePath('/finance');
  redirect('/finance?tab=expenses');
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

  const html = invoiceHtml({
    number: invoice!.number,
    clientName: invoice!.client.name,
    projectName: invoice!.project?.name,
    amount: invoice!.amount,
    currency: invoice!.currency,
    issuedAt: invoice!.issuedAt,
    dueAt: invoice!.dueAt,
    notes: invoice!.notes,
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

  const html = receiptHtml({
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
  await prisma.client.deleteMany({ where: { name: { startsWith: 'Demo —' } } });
  await prisma.expense.deleteMany({ where: { title: { startsWith: 'Demo —' } } });
  await prisma.user.deleteMany({ where: { email: 'demo.sales@uaagency.com' } });
  revalidatePath('/');
  redirect('/settings?done=cleared');
}

export async function seedDemoData() {
  const rates = await getRatesToCad();
  const cadOf = (a: number, c: string) => toCad(a, c, rates);
  const admin = await prisma.user.findFirst({ where: { roles: { has: 'SUPER_ADMIN' as any } } });
  const sales = await prisma.user.upsert({
    where: { email: 'demo.sales@uaagency.com' },
    update: { roles: ['SALES'] as any },
    create: { email: 'demo.sales@uaagency.com', name: 'Demo Salesperson', roles: ['SALES'] as any },
  });

  const defs = [
    { client: 'Demo — Brightline', lead: 'GENERATED', project: 'Brightline Website', type: 'DEVELOPMENT', budget: 12000, cur: 'USD', status: 'ACTIVE', pay: 6000, payCur: 'USD' },
    { client: 'Demo — Nova Foods', lead: 'INVITE', project: 'Nova Branding', type: 'DESIGN', budget: 4000, cur: 'CAD', status: 'ACTIVE', pay: 4000, payCur: 'CAD' },
    { client: 'Demo — Karachi Tech', lead: 'GENERATED', project: 'KT Mobile App', type: 'SOFTWARE', budget: 8000, cur: 'USD', status: 'ONBOARDING', pay: 2000, payCur: 'USD' },
  ];

  const statuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
  const prios = ['LOW', 'MEDIUM', 'HIGH'];

  for (const d of defs) {
    const client = await prisma.client.create({
      data: {
        name: d.client,
        email: `hello@${d.client.replace('Demo — ', '').toLowerCase().replace(/\s+/g, '')}.com`,
        source: 'UPWORK' as any,
        leadType: d.lead as any,
        salespersonId: sales.id,
        projects: {
          create: {
            name: d.project,
            type: d.type as any,
            budgetAmount: d.budget,
            budgetCurrency: d.cur,
            budgetType: 'FIXED' as any,
            status: d.status as any,
            priority: 'MEDIUM' as any,
            pmCommissionRate: 10,
            members: admin ? { create: { userId: admin.id, role: 'PROJECT_MANAGER' as any } } : undefined,
          },
        },
      },
      include: { projects: true },
    });
    const project = client.projects[0];

    await prisma.invoice.create({
      data: { clientId: client.id, projectId: project.id, amount: d.budget, currency: d.cur, status: 'SENT' as any },
    });
    await prisma.payment.create({
      data: {
        clientId: client.id,
        projectId: project.id,
        amount: d.pay,
        currency: d.payCur,
        amountCad: cadOf(d.pay, d.payCur),
        method: 'BANK_TRANSFER' as any,
        paidAt: new Date(),
      },
    });
    for (let i = 0; i < 5; i++) {
      await prisma.task.create({
        data: {
          projectId: project.id,
          title: `Demo task ${i + 1}`,
          status: statuses[i] as any,
          priority: prios[i % 3] as any,
          assigneeId: admin?.id ?? null,
        },
      });
    }
  }

  const exp = [
    { t: 'Demo — Adobe CC', a: 60, c: 'USD', cat: 'SOFTWARE' },
    { t: 'Demo — Office (Karachi)', a: 50000, c: 'PKR', cat: 'OFFICE' },
    { t: 'Demo — Hosting', a: 20, c: 'USD', cat: 'HOSTING' },
  ];
  for (const e of exp) {
    await prisma.expense.create({
      data: { title: e.t, category: e.cat as any, amount: e.a, currency: e.c, amountCad: cadOf(e.a, e.c), date: new Date() },
    });
  }

  await prisma.salary.create({ data: { userId: sales.id, amount: 1500, currency: 'CAD', effectiveFrom: new Date() } });
  await prisma.salaryPayment.create({ data: { userId: sales.id, amount: 1500, currency: 'CAD', amountCad: 1500, paidAt: new Date(), method: 'Wise' } });
  await prisma.commissionPayout.create({ data: { userId: sales.id, amount: 200, paidAt: new Date(), method: 'Wise', note: 'Demo payout' } });

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
