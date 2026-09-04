# Keel — the operating system your agency runs on

> **Living document.** This is the master reference of everything Keel does — kept
> up to date as features ship, and written to double as a client-facing pitch.
> **When you add or change a feature, update this file in the same change.**

Keel is an **all-in-one operations platform for agencies**. Instead of stitching
together a project tool, a CRM, a finance app, a chat tool, a scheduling tool and
a lead-gen tool, an agency runs the whole business in one place — delivery,
money, sales, team and clients — with roles, notifications, and Google Workspace
built in.

---

## What Keel does, module by module

### Dashboard
A single command center: live KPIs, income-vs-expense chart, projects by status,
upcoming deadlines and tasks, upcoming meetings, and (for leadership) fresh
buying-intent signals. Timezone-aware live clocks for distributed teams.

### Clients (CRM)
Client records with source, industry, contacts and history. Leads convert into
clients; won deals flow straight into projects.

### Projects & Tasks (delivery)
- Project types, budgets (fixed / hourly / retainer), priorities, and a status
  pipeline (onboarding → active → on-hold → completed → archived).
- Team members assigned by discipline (project manager / developer / designer).
- Tasks with a Kanban-style status flow (backlog → to-do → in progress → in
  review → done), **approval gating**, assignees, and threaded comments.
- Deadlines, contracts, file attachments, and Figma-style resolvable comment
  threads on projects, tasks and clients.

### Meetings & Scheduling
- **Request → approve flow:** anyone can request a meeting with anyone — propose
  a time *or* ask for the person's availability. The invitee (or an admin)
  approves, adjusts, declines with a reason, or counter-proposes a time.
- **Full calendar** with month / week / day / agenda views and a Google-style
  view switcher.
- On approval it's booked, a **Google Meet link is auto-generated**, and every
  participant is notified **three ways**: in-app, phone push, and email — with an
  **.ics invite** so it lands in any calendar.
- Super Admins / Admins see the whole team's calendar and pending requests.

### Time tracking & Agency hours
Per-person time entries with approvals and reports; timezone-aware agency
schedules with live local clocks across offices.

### Growth / Lead generation
- **Apollo search:** find B2B leads by title, industry, location and headcount;
  auto-score and enroll into outreach sequences.
- **X / Twitter listener:** watches for buying-intent posts via twitterapi.io,
  **AI-scores** each one, learns from your labels, suggests keywords, drafts
  replies, and converts a lead into a client — no X login required.

### Money
- **Invoices:** generated from projects, with statuses, PDF export, and email
  delivery; receipts.
- **Finance:** income and expenses by category, **multi-currency** normalized to
  CAD via live FX, and **GST/QST tax** handling.
- **Statements:** import bank / credit-card statement PDFs, **parsed by AI** into
  transactions, with reusable categorization rules.
- **Commissions & salaries:** sales commissions and PM commission rates, payouts,
  salaries and salary payments; expenses with payer and tax back-out.
- **Reports:** finance and time reports, exportable to PDF / CSV.

### Team, roles & permissions
- Roles: **Super Admin, Admin, Manager, Project Manager, Developer, Designer,
  Sales** — governed by a single central permissions map.
- Add a member and they get a username + temporary password and a **role-aware
  welcome email**, with a **forced password reset on first login**.
- Admins see Super Admins as "Admin" (indistinguishable); the most sensitive
  tools (integrations, database, reset) are Super-Admin-only.

### Communication
- **Messages:** direct and group messaging with attachments and @mentions.
- **AI Assistant:** a chatbot that answers questions over your own live data
  (finance, projects, clients…), with per-user credit tracking.
- **Notifications:** in-app + installable **web-push** (PWA) with per-category
  preferences.

### Vault & compliance
- **Shared logins:** an encrypted team password vault with per-item sharing.
- **Letters:** Revenu Québec letter generation (Super-Admin-only).

### Settings & integrations
Company details, customizable dropdown options, database migrations and data
reset — plus one-click, dashboard-managed integrations (no redeploys):
**Google (Drive, Calendar, Meet, Gmail), Email, OpenRouter AI, Apollo,
X/twitterapi.io, Wave accounting, automation/cron, push.** Secrets are stored
**encrypted**; every key is settable from the UI with a reveal toggle.

---

## Platform qualities
- **White-label ready** — one connected Google Workspace account can power email,
  calendar, Meet and file storage (see roadmap).
- **PWA / installable** on desktop and phone, with push notifications.
- **Multi-currency & multi-timezone** throughout.
- **Security:** JWT sessions, AES-256-GCM-encrypted secrets and vault entries,
  role-based access control, forced first-login password reset.
- **Auto-deploys** to production on every change.

---

## How Keel compares

Most agencies pay for 5–7 tools that each solve one slice. Keel replaces the
stack with one system that also knows about *money* and *clients* — which none of
the tools below do together.

| Capability | **Keel** | Slack | Notion | Asana | ClickUp | Trello |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Projects & tasks | ✅ | ❌ | ➖ | ✅ | ✅ | ✅ |
| Task approvals workflow | ✅ | ❌ | ➖ | ➖ | ➖ | ❌ |
| Team messaging & @mentions | ✅ | ✅ | ➖ | ➖ | ➖ | ❌ |
| CRM / clients & leads | ✅ | ❌ | ➖ | ❌ | ➖ | ❌ |
| Built-in lead generation (Apollo + X, AI-scored) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Invoicing & finance | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bank/CC statement import (AI) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Commissions & payroll | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Time tracking | ✅ | ❌ | ➖ | ➖ | ✅ | ➖ |
| Meeting scheduling + Google Meet | ✅ | ➖ | ❌ | ❌ | ➖ | ❌ |
| Full calendar (month/week/day) | ✅ | ❌ | ➖ | ✅ | ✅ | ➖ |
| AI assistant over your own data | ✅ | ➖ | ✅ | ➖ | ✅ | ❌ |
| Encrypted shared-login vault | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Roles & granular permissions | ✅ | ➖ | ➖ | ✅ | ✅ | ➖ |
| Push notifications (installable PWA) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Google Workspace integration | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

✅ = built-in · ➖ = partial / add-on / paid tier · ❌ = not available

**Positioning:** Slack is chat, Notion is docs, and Asana/ClickUp/Trello are task
boards. **Keel is the agency's operating system** — it runs delivery *and* the
money *and* the sales pipeline *and* the team, so the business lives in one place
instead of seven.

---

## Roadmap / in progress
- **One-click "Connect Google"** — a single Sign-in-with-Google that powers Gmail
  sending, Calendar, Meet and Drive from one connected Workspace account (making
  white-label onboarding a single button).
- **Deadline → calendar sync** — project deadlines auto-appear on the calendar.
- **Meeting reminders** — push/email a set time before a meeting starts.

---

*Last updated: 2026-09-04.*
