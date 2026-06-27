import { prisma } from '@/lib/prisma';

/**
 * Convert a won lead into a real Client. Idempotent: if the lead was already
 * converted, returns the existing client. Sets the lead to "won", links it to
 * the new client, and stops any active outreach.
 */
export async function convertLeadToClient(leadId: string, salespersonId?: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { company: true } });
  if (!lead) throw new Error('Lead not found');
  if (lead.convertedClientId) {
    return prisma.client.findUnique({ where: { id: lead.convertedClientId } });
  }

  const contactName = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || null;
  const website = lead.company?.domain ? `https://${lead.company.domain}` : null;

  const client = await prisma.client.create({
    data: {
      name: lead.company?.name ?? contactName ?? 'New client',
      contactName,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      source: 'LEAD_GEN',
      industry: lead.company?.industry ?? null,
      location: lead.company?.location ?? null,
      website,
      socialLinks: lead.linkedinUrl ?? null,
      notes: lead.segment ? `Converted from lead-gen (${lead.segment}).` : 'Converted from lead-gen.',
      ...(salespersonId ? { salespersonId } : {}),
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: 'won', convertedClientId: client.id },
  });
  await prisma.sequenceEnrollment.updateMany({
    where: { leadId, status: 'active' },
    data: { status: 'stopped', nextActionAt: null },
  });
  await prisma.leadActivity.create({
    data: { leadId, type: 'converted', detail: `→ client ${client.id}` },
  });

  return client;
}
