// Shared (client + server safe) notification category metadata. Users toggle
// these in Settings → Notifications; each maps one or more notification `type`s.

export const NOTIFY_CATEGORIES = [
  { id: 'leads', label: 'New leads', desc: 'High-scoring X signals worth reaching out to' },
  { id: 'messages', label: 'Messages', desc: 'New direct messages' },
  { id: 'mentions', label: 'Mentions', desc: 'When someone @mentions you' },
  { id: 'tasks', label: 'Tasks & approvals', desc: 'Task approvals and assignments' },
  { id: 'meetings', label: 'Meetings', desc: 'Meeting requests, approvals and reminders' },
  { id: 'team', label: 'Team', desc: 'Shared logins, leave requests' },
] as const;

export type NotifyCategory = (typeof NOTIFY_CATEGORIES)[number]['id'];

// notification.type → category
const TYPE_TO_CATEGORY: Record<string, NotifyCategory> = {
  x_lead: 'leads',
  message: 'messages',
  mention: 'mentions',
  task_approval: 'tasks',
  meeting_request: 'meetings',
  meeting_approved: 'meetings',
  meeting_declined: 'meetings',
  meeting_proposed: 'meetings',
  meeting_cancelled: 'meetings',
  meeting_reminder: 'meetings',
  login_shared: 'team',
  leave: 'team',
};

/** Whether a push for this notification type is allowed by the user's prefs (default on). */
export function pushAllowed(prefs: unknown, type: string): boolean {
  const cat = TYPE_TO_CATEGORY[type];
  if (!cat) return true; // unknown types default on
  if (!prefs || typeof prefs !== 'object') return true;
  const v = (prefs as Record<string, unknown>)[cat];
  return v === undefined || v === null ? true : !!v;
}

/** Normalize an arbitrary object into a full prefs map (missing = true). */
export function normalizePrefs(prefs: unknown): Record<NotifyCategory, boolean> {
  const p = (prefs && typeof prefs === 'object' ? prefs : {}) as Record<string, unknown>;
  const out = {} as Record<NotifyCategory, boolean>;
  for (const c of NOTIFY_CATEGORIES) out[c.id] = p[c.id] === undefined || p[c.id] === null ? true : !!p[c.id];
  return out;
}
