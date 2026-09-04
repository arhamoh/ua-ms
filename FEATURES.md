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
- **Reminders** go out before each meeting; **project deadlines auto-sync** to
  the calendar as all-day events.
- Super Admins / Admins see the whole team's calendar and pending requests.

### Drive (files)
A **Google Drive workspace** built in (Delivery → Drive):
- **Browse, upload, rename, and delete** (to trash) files and folders.
- **One-click provision** a tidy folder tree for every client and project —
  `Client / Project / standard sub-folders` tailored to the project type (design
  vs development/software).
- **Tag a teammate** on any file → they get read access + a notification
  (in-app + push + email) with a direct link.
- **Comment** on a file with **@mentions** that notify the mentioned teammate.
- **Project-scoped access:** Super Admin / Admin / Manager / PM see the whole
  Drive; developers, designers and others see **only the folders of projects
  they're assigned to**.
- **Dedicated storage:** point Keel at its own "Keel" folder or a Shared Drive so
  its files never mix with the connected account's personal files.
- Each **project page → Files** shows that project's Drive folder inline with an
  "Open in Drive" shortcut.

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
- Add a member with a name, email and optional **username** — a temporary
  password is generated and **emailed automatically**, and they set their own on
  first login. They sign in with their username or email.
- **Password controls:** send a **self-service reset link** by email (public
  "forgot password" too), set a password directly, or re-send the welcome email.
- **Impersonation (view-as):** a Super Admin can view the platform as any member
  to see exactly what they see, with a banner and one-click exit.
- **Scoped Settings:** Super Admin & Admin see the org settings (company,
  notifications, options); everyone else sees only their **own account**
  (username, password, timezone) and notifications. Integrations, database and
  reset stay Super-Admin-only.
- Admins see Super Admins as "Admin" (indistinguishable).

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
**Google (Gmail, Calendar, Meet, Drive — one connection), OpenRouter AI, Apollo,
X/twitterapi.io, Wave accounting, automation/cron, push.** Secrets are stored
**encrypted**; every key is settable from the UI with a reveal toggle.

---

### Marketing site (public landing)
The root URL (`/`) is a public marketing landing page — feature overview, a
"cancel the stack" cost comparison, industry testimonials, and seat-graded
pricing tiers — with **Sign in / Get started** buttons that go to `/login`.
Signed-in visitors are sent straight to their **dashboard** (`/dashboard`). The
page is authored as a self-contained HTML file (`lib/landing.html`) so it can be
edited without touching the app shell.

## Platform qualities
- **White-label ready** — a single **"Connect Google"** button links one Google
  Workspace account that powers email (Gmail), Calendar, Meet and Drive file
  storage — one-click onboarding for every new customer.
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

## Roadmap / ideas
- **Free/busy availability** — see open slots when picking a meeting time.
- **Two-way calendar sync** — reflect edits/cancellations made in Google back
  into Keel.
- **Per-user Google calendars** — each team member connects their own account.

---

## Setup & how-to guides

Short, current tutorials for the things people set up or use most.

### Connect Google (email, Calendar, Meet, Drive — one connection)
1. In [Google Cloud](https://console.cloud.google.com), create a project and
   **enable** the Gmail, Google Calendar and Google Drive APIs.
2. **OAuth consent screen → User type = Internal** (skips verification for your
   own Workspace).
3. **Credentials → Create OAuth client ID → Web application**, and add the
   redirect URI `https://<your-domain>/api/integrations/google/callback`.
4. In Keel: **Settings → Integrations → Google Workspace** → paste the Client ID
   & secret → **Save** → **Connect Google** → approve. Done — Gmail, Calendar,
   Meet and Drive now run on that account. Until connected, email uses Resend and
   meetings still work in-platform.

### Add a team member
**Team → Members → Add** a name, email and roles (optionally a temp password —
otherwise one is generated). They get a username + temporary password (shown to
you once, and emailed if welcome emails are on) and are **forced to set their own
password on first login**.

### Roles & permissions
Seven roles (Super Admin → Sales). **Team → Role access** (Super-Admin-only)
shows exactly what each role can reach. Admins see everything except Letters and
the sensitive Settings tabs (Integrations, Database, Reset), which are
Super-Admin-only. Admins also see Super Admins labelled as "Admin".

### Integrations & secrets
Every key is set in **Settings → Integrations** (no redeploy) — env vars are only
a fallback, so you don't need to also set them in the host. Set values show
masked with an **eye toggle** to reveal/edit. Cards are grouped by type. Once
Google is connected there's a **Send test email** button and a **Drive browser**
to confirm everything works.

### Book & approve meetings
**Meetings → Request a meeting**: pick who to meet, propose a time or ask their
availability, add a client and attendees. The invitee (or an admin) approves,
adjusts, declines, or proposes a new time. On approval it's booked with a Meet
link and everyone is notified. Calendar has month/week/day/agenda views.

### Automation (cron) — deadlines, reminders, lead-gen
Set a **CRON_SECRET** (Settings → Integrations → Automation), then point a
scheduler (Railway Cron / cron-job.org) at
`/api/leads/cron?task=<task>` with header `Authorization: Bearer <CRON_SECRET>`:
- `task=reminders` every ~15 min — meeting reminders.
- `task=deadlines` daily — sync project deadlines to Google Calendar.
- `task=all` also runs lead sourcing, X polling and outreach.

### Lead generation
- **Leads → Apollo:** search by title/industry/location; results are scored and
  can be enrolled into outreach.
- **Leads → X:** add keywords (or load recommended), poll, and the AI scores
  buying-intent posts; label a few to teach it, draft replies, convert to client.

### Statement import (finance)
**Statements → upload** a bank/credit-card PDF; the AI parses it into
transactions you can categorize (with reusable rules) and reconcile.

### Notifications (install as an app)
**Settings → Notifications → Enable** for phone/desktop push. On iPhone, first
add Keel to your Home Screen, then open it and enable. Toggle categories
(leads, messages, meetings, tasks, team) per device.

---

*Last updated: 2026-09-04.*
