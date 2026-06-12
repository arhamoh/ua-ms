// Human-friendly labels + option lists for our Prisma enums.

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER: 'Manager',
  PROJECT_MANAGER: 'Project Manager',
  DEVELOPER: 'Developer',
  DESIGNER: 'Designer',
};
export const ROLES = Object.keys(ROLE_LABELS);

export const PROJECT_ROLE_LABELS: Record<string, string> = {
  PROJECT_MANAGER: 'Project Manager',
  DEVELOPER: 'Developer',
  DESIGNER: 'Designer',
};

export const CLIENT_SOURCE_LABELS: Record<string, string> = {
  UPWORK: 'Upwork',
  AGENCY: 'Agency',
  REFERRAL: 'Referral',
  OTHER: 'Other',
};
export const CLIENT_SOURCES = Object.keys(CLIENT_SOURCE_LABELS);

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  DESIGN: 'Design',
  DEVELOPMENT: 'Development',
  SOFTWARE: 'Software',
};
export const PROJECT_TYPES = Object.keys(PROJECT_TYPE_LABELS);

export const BUDGET_TYPE_LABELS: Record<string, string> = {
  FIXED: 'Fixed',
  HOURLY: 'Hourly',
  RETAINER: 'Retainer',
};
export const BUDGET_TYPES = Object.keys(BUDGET_TYPE_LABELS);

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};
export const PRIORITIES = Object.keys(PRIORITY_LABELS);

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  ONBOARDING: 'Onboarding',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD'];

export const STATUS_BADGE: Record<string, string> = {
  ONBOARDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  ON_HOLD: 'bg-slate-200 text-slate-600',
  COMPLETED: 'bg-blue-100 text-blue-700',
  ARCHIVED: 'bg-slate-100 text-slate-400',
};
