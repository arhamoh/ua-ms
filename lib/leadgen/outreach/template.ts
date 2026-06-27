import { sender } from '../sender';

export interface LeadVars {
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  company?: { name?: string | null } | null;
}

/** Replace {{tokens}} in a template with lead + sender values. */
export function render(tpl: string, lead: LeadVars): string {
  const vars: Record<string, string> = {
    firstName: lead.firstName ?? 'there',
    lastName: lead.lastName ?? '',
    title: lead.title ?? '',
    company: lead.company?.name ?? 'your company',
    senderName: sender.name,
    senderCompany: sender.company,
    calendarLink: sender.calendarLink,
    portfolioLink: sender.portfolioLink,
  };
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

/** CAN-SPAM footer appended to every commercial email. */
export function emailFooter(): string {
  return `\n\n—\n${sender.company} · ${sender.mailingAddress}\nNot relevant? Reply "unsubscribe" and I won't contact you again.`;
}
