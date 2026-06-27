import { prisma } from '@/lib/prisma';
import { sequences, getSequenceDef } from '../sequences';
import { render, emailFooter } from './template';
import { channelFor } from './channels';

const DAY_MS = 24 * 60 * 60 * 1000;
const STOPPED_LEAD_STATES = ['replied', 'won', 'lost', 'unqualified'];

/** SEED: write the code-defined sequences into the database (idempotent). */
export async function seedSequences(): Promise<void> {
  for (const def of sequences) {
    const seq = await prisma.sequence.upsert({
      where: { key: def.key },
      update: { name: def.name },
      create: { key: def.key, name: def.name, channel: 'multi' },
    });
    await prisma.sequenceStep.deleteMany({ where: { sequenceId: seq.id } });
    await prisma.sequenceStep.createMany({
      data: def.steps.map((s, i) => ({
        sequenceId: seq.id,
        order: i,
        channel: s.channel,
        delayDays: s.delayDays,
        subject: s.subject,
        body: s.body,
      })),
    });
  }
}

/** ENROLL: put a segment's scored leads into its sequence (first touch due now). */
export async function enrollSegment(segmentKey: string): Promise<{ enrolled: number }> {
  const def = getSequenceDef(segmentKey);
  if (!def) throw new Error(`No sequence for segment "${segmentKey}".`);
  const seq = await prisma.sequence.findUnique({ where: { key: segmentKey } });
  if (!seq) throw new Error(`Sequence "${segmentKey}" not seeded.`);

  const leads = await prisma.lead.findMany({
    where: { segment: segmentKey, status: { notIn: STOPPED_LEAD_STATES } },
  });

  let enrolled = 0;
  for (const lead of leads) {
    const existing = await prisma.sequenceEnrollment.findUnique({
      where: { leadId_sequenceId: { leadId: lead.id, sequenceId: seq.id } },
    });
    if (existing) continue;
    await prisma.sequenceEnrollment.create({
      data: { leadId: lead.id, sequenceId: seq.id, currentStep: 0, status: 'active', nextActionAt: new Date() },
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'queued' } });
    enrolled++;
  }
  return { enrolled };
}

/** RUN: process every enrollment whose next touch is due. */
export async function runDue(limit = 200): Promise<{ sent: number; skipped: number; completed: number }> {
  const now = new Date();
  const due = await prisma.sequenceEnrollment.findMany({
    where: { status: 'active', nextActionAt: { lte: now } },
    include: {
      lead: { include: { company: true } },
      sequence: { include: { steps: { orderBy: { order: 'asc' } } } },
    },
    take: limit,
  });

  let sent = 0;
  let skipped = 0;
  let completed = 0;

  for (const en of due) {
    const lead = en.lead;

    if (STOPPED_LEAD_STATES.includes(lead.status)) {
      await prisma.sequenceEnrollment.update({ where: { id: en.id }, data: { status: 'stopped', nextActionAt: null } });
      continue;
    }

    const steps = en.sequence.steps;
    const step = steps[en.currentStep];
    if (!step) {
      await prisma.sequenceEnrollment.update({ where: { id: en.id }, data: { status: 'completed', nextActionAt: null } });
      completed++;
      continue;
    }

    const deliverable =
      (step.channel === 'email' && lead.email) ||
      (step.channel === 'linkedin' && lead.linkedinUrl) ||
      (step.channel === 'sms' && lead.phone && lead.smsConsent);

    const leadName = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || '(no name)';

    if (deliverable) {
      const channel = channelFor(step.channel);
      const body = render(step.body, lead) + (step.channel === 'email' ? emailFooter() : '');
      const result = await channel.send({
        toEmail: lead.email,
        toLinkedIn: lead.linkedinUrl,
        toPhone: lead.phone,
        leadName,
        subject: step.subject ? render(step.subject, lead) : undefined,
        body,
      });
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: result.manual ? `${step.channel}_task` : `${step.channel}_sent`,
          channel: step.channel,
          detail: result.detail,
        },
      });
      if (result.ok) sent++;
      if (lead.status === 'queued') {
        await prisma.lead.update({ where: { id: lead.id }, data: { status: 'contacted' } });
      }
    } else {
      await prisma.leadActivity.create({
        data: { leadId: lead.id, type: 'skipped', channel: step.channel, detail: `no ${step.channel} target / consent` },
      });
      skipped++;
    }

    const nextIndex = en.currentStep + 1;
    const next = steps[nextIndex];
    if (next) {
      await prisma.sequenceEnrollment.update({
        where: { id: en.id },
        data: { currentStep: nextIndex, nextActionAt: new Date(now.getTime() + next.delayDays * DAY_MS) },
      });
    } else {
      await prisma.sequenceEnrollment.update({
        where: { id: en.id },
        data: { currentStep: nextIndex, status: 'completed', nextActionAt: null },
      });
      completed++;
    }
  }

  return { sent, skipped, completed };
}

/** REPLY: mark a lead as replied and stop all their active sequences. */
export async function markReplied(leadId: string): Promise<void> {
  await prisma.lead.update({ where: { id: leadId }, data: { status: 'replied' } });
  await prisma.sequenceEnrollment.updateMany({
    where: { leadId, status: 'active' },
    data: { status: 'stopped', nextActionAt: null },
  });
  await prisma.leadActivity.create({ data: { leadId, type: 'replied', detail: 'manual mark' } });
}

export { sequences };
