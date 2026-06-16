// Human-friendly labels + option lists for our Prisma enums.

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER: 'Manager',
  PROJECT_MANAGER: 'Project Manager',
  DEVELOPER: 'Developer',
  DESIGNER: 'Designer',
  SALES: 'Sales',
};
export const ROLES = Object.keys(ROLE_LABELS);

// Lead attribution → sales commission rate (%)
export const LEAD_TYPE_LABELS: Record<string, string> = {
  INVITE: 'Invite (5%)',
  GENERATED: 'Generated lead (10%)',
};
export const LEAD_TYPES = Object.keys(LEAD_TYPE_LABELS);
export const SALES_COMMISSION_RATE: Record<string, number> = {
  INVITE: 5,
  GENERATED: 10,
};

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

export const TASK_STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};
export const TASK_STATUSES = Object.keys(TASK_STATUS_LABELS);

export const TASK_STATUS_DOT: Record<string, string> = {
  BACKLOG: 'bg-slate-400',
  TODO: 'bg-sky-500',
  IN_PROGRESS: 'bg-amber-500',
  IN_REVIEW: 'bg-violet-500',
  DONE: 'bg-emerald-500',
};

export const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-slate-300',
  MEDIUM: 'bg-amber-400',
  HIGH: 'bg-rose-500',
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  SOFTWARE: 'Software',
  HOSTING: 'Hosting',
  MARKETING: 'Marketing',
  OFFICE: 'Office',
  CONTRACTOR: 'Contractor',
  EQUIPMENT: 'Equipment',
  FEES: 'Fees',
  OTHER: 'Other',
};
export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS);

export const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'PKR'];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  PAYPAL: 'PayPal',
  CASH: 'Cash',
  CRYPTO: 'Crypto',
  OTHER: 'Other',
};
export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS);

// Format an amount with a currency code, e.g. formatMoney(8000, 'USD') -> "$8,000".
export function formatMoney(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export const STATUS_BADGE: Record<string, string> = {
  ONBOARDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  ON_HOLD: 'bg-slate-200 text-slate-600',
  COMPLETED: 'bg-blue-100 text-blue-700',
  ARCHIVED: 'bg-slate-100 text-slate-400',
};
