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
} from '@/lib/enums';

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
  const projectType = PROJECT_TYPES.includes(rawType ?? '') ? rawType! : 'DESIGN';

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
    members: members.length ? { create: members.map((m) => ({ userId: m.userId, role: m.role })) } : undefined,
  };
}

export async function onboardClient(formData: FormData) {
  const clientName = str(formData.get('clientName'));
  if (!clientName) throw new Error('Client name is required.');

  const rawSource = str(formData.get('source'));
  const source = CLIENT_SOURCES.includes(rawSource ?? '') ? (rawSource as any) : null;

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
      projects: { create: buildProjectData(formData) },
    },
    include: { projects: true },
  });

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

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/clients');
  revalidatePath('/');
  redirect(`/projects/${project.id}`);
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

  const rawMethod = str(formData.get('method'));
  const method = PAYMENT_METHODS.includes(rawMethod ?? '')
    ? (rawMethod as any)
    : 'BANK_TRANSFER';

  const paidRaw = str(formData.get('paidAt'));
  const projectId = str(formData.get('projectId'));

  await prisma.payment.create({
    data: {
      clientId,
      amount,
      currency: str(formData.get('currency')) ?? 'USD',
      method,
      paidAt: paidRaw ? new Date(paidRaw) : new Date(),
      note: str(formData.get('note')),
      projectId: projectId || null,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
