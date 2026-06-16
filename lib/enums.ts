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
  CANCELLED: 'Cancelled',
  ARCHIVED: 'Archived',
};
export const PROJECT_STATUSES = Object.keys(PROJECT_STATUS_LABELS);

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
  SUBSCRIPTION: 'Subscriptions',
  HOSTING: 'Hosting',
  UTILITIES: 'Utilities',
  MARKETING: 'Marketing',
  OFFICE: 'Office',
  TRAVEL: 'Travel',
  MEALS: 'Meals',
  CONTRACTOR: 'Contractor',
  EQUIPMENT: 'Equipment',
  FEES: 'Fees',
  TAXES: 'Taxes',
  OTHER: 'Other',
};
export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS);

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  VOID: 'Void',
};
export const INVOICE_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  VOID: 'bg-rose-100 text-rose-700',
};

export const FILE_CATEGORY_LABELS: Record<string, string> = {
  LOGO: 'Logos',
  DESIGN: 'Designs',
  DOCUMENT: 'Documents',
  CONTRACT: 'Contracts',
  ASSET: 'Assets',
  OTHER: 'Other',
};
export const FILE_CATEGORIES = Object.keys(FILE_CATEGORY_LABELS);

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
  CANCELLED: 'bg-rose-100 text-rose-700',
  ARCHIVED: 'bg-slate-100 text-slate-400',
};

export const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-500',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-rose-100 text-rose-700',
};

export const TASK_STATUS_BADGE: Record<string, string> = {
  BACKLOG: 'bg-slate-100 text-slate-500',
  TODO: 'bg-sky-100 text-sky-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  IN_REVIEW: 'bg-violet-100 text-violet-700',
  DONE: 'bg-emerald-100 text-emerald-700',
};

export const PROJECT_TYPE_BADGE: Record<string, string> = {
  DESIGN: 'bg-violet-100 text-violet-700',
  DEVELOPMENT: 'bg-sky-100 text-sky-700',
  SOFTWARE: 'bg-indigo-100 text-indigo-700',
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vacation',
  SICK: 'Sick',
  ABSENT: 'Absent',
  UNPAID: 'Unpaid',
  OTHER: 'Other',
};
export const LEAVE_TYPES = Object.keys(LEAVE_TYPE_LABELS);
export const LEAVE_TYPE_BADGE: Record<string, string> = {
  VACATION: 'bg-sky-100 text-sky-700',
  SICK: 'bg-violet-100 text-violet-700',
  ABSENT: 'bg-rose-100 text-rose-700',
  UNPAID: 'bg-slate-100 text-slate-600',
  OTHER: 'bg-slate-100 text-slate-500',
};
export const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};
export const LEAVE_STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
};

export const EXPENSE_CATEGORY_BADGE: Record<string, string> = {
  SOFTWARE: 'bg-indigo-100 text-indigo-700',
  SUBSCRIPTION: 'bg-violet-100 text-violet-700',
  HOSTING: 'bg-sky-100 text-sky-700',
  UTILITIES: 'bg-cyan-100 text-cyan-700',
  MARKETING: 'bg-pink-100 text-pink-700',
  OFFICE: 'bg-slate-100 text-slate-600',
  TRAVEL: 'bg-orange-100 text-orange-700',
  MEALS: 'bg-lime-100 text-lime-700',
  CONTRACTOR: 'bg-amber-100 text-amber-700',
  EQUIPMENT: 'bg-teal-100 text-teal-700',
  FEES: 'bg-rose-100 text-rose-700',
  TAXES: 'bg-red-100 text-red-700',
  OTHER: 'bg-slate-100 text-slate-500',
};
