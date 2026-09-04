// Central source of truth for user types and what each can access.
// Today access is enforced by scattered role checks and the sidebar's role
// flags; this map mirrors that so it can be shown in one place and become the
// single knob we tune as we change permissions.

import { ROLE_LABELS } from '@/lib/enums';

export type Role = 'SUPER_ADMIN' | 'MANAGER' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'DESIGNER' | 'SALES';

// Display order + a one-line description of what each type of user is.
export const ROLE_ORDER: Role[] = ['SUPER_ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'DEVELOPER', 'DESIGNER', 'SALES'];

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: 'Full access to everything — finance, leads, letters, settings, and every admin tool.',
  MANAGER: 'Runs the team day-to-day: reports and time approvals, plus all delivery and money views.',
  PROJECT_MANAGER: 'Leads projects: approve tasks, manage agency hours and shared logins.',
  DEVELOPER: 'Delivery role: projects, tasks, time, messages, and shared logins.',
  DESIGNER: 'Delivery role: projects, tasks, time, messages, and shared logins.',
  SALES: 'Brings in business: clients, projects, commissions, and shared logins.',
};

export const roleLabel = (r: string) => ROLE_LABELS[r] ?? r;

// An area of the app + which roles can access it. `'all'` = every signed-in
// member. Grouped to match the sidebar.
export type Area = { key: string; label: string; group: string; roles: Role[] | 'all' };

const ADMIN: Role[] = ['SUPER_ADMIN', 'MANAGER'];
const PM_UP: Role[] = ['SUPER_ADMIN', 'MANAGER', 'PROJECT_MANAGER'];
const SUPER: Role[] = ['SUPER_ADMIN'];

export const AREAS: Area[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'General', roles: 'all' },

  { key: 'clients', label: 'Clients', group: 'Delivery', roles: 'all' },
  { key: 'projects', label: 'Projects', group: 'Delivery', roles: 'all' },
  { key: 'task_approval', label: 'Approve tasks', group: 'Delivery', roles: PM_UP },
  { key: 'agency_hours', label: 'Manage agency hours', group: 'Delivery', roles: PM_UP },

  { key: 'leads', label: 'Leads (Apollo & X)', group: 'Growth', roles: SUPER },

  { key: 'invoices', label: 'Invoices', group: 'Money', roles: 'all' },
  { key: 'finance', label: 'Finance', group: 'Money', roles: 'all' },
  { key: 'statements', label: 'Statements', group: 'Money', roles: 'all' },
  { key: 'commissions', label: 'Commissions', group: 'Money', roles: 'all' },

  { key: 'time', label: 'Time tracking (own)', group: 'Team', roles: 'all' },
  { key: 'time_reports', label: 'Time reports (everyone)', group: 'Team', roles: ADMIN },
  { key: 'members', label: 'Team members', group: 'Team', roles: 'all' },
  { key: 'reports', label: 'Reports', group: 'Team', roles: ADMIN },

  { key: 'messages', label: 'Messages', group: 'More', roles: 'all' },
  { key: 'assistant', label: 'AI Assistant', group: 'More', roles: 'all' },
  { key: 'letters', label: 'Letters (Revenu Québec)', group: 'More', roles: SUPER },
  { key: 'logins_view', label: 'Shared logins — view', group: 'More', roles: 'all' },
  { key: 'logins_manage', label: 'Shared logins — manage', group: 'More', roles: PM_UP },
  { key: 'settings', label: 'Settings (personal)', group: 'More', roles: 'all' },
  { key: 'settings_admin', label: 'Settings — integrations, database, reset', group: 'More', roles: SUPER },
];

/** Does this role have access to an area? */
export function roleCanAccess(role: string, area: Area): boolean {
  return area.roles === 'all' || (area.roles as string[]).includes(role);
}

/** Do any of a user's roles grant access to an area key? */
export function canAccess(roles: string[] | null | undefined, key: string): boolean {
  const area = AREAS.find((a) => a.key === key);
  if (!area) return false;
  if (area.roles === 'all') return !!roles?.length;
  return !!roles?.some((r) => (area.roles as string[]).includes(r));
}

/** Human summary of what a single role can reach (for the overview cards). */
export function areasForRole(role: string): Area[] {
  return AREAS.filter((a) => roleCanAccess(role, a));
}
