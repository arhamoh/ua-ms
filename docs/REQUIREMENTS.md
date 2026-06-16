# UA Platform — Requirements (living document)

> Working spec, captured as the breakdown evolves. Nothing here is final until we build it.
> Last updated: 2026-06-12

## 1. Users & Roles

The platform has multiple user roles. **A single user can hold multiple roles at once**
(e.g. someone could be both a Project Manager and a Developer).

### Roles & permissions (first draft, inferred from role names)
- **Multi-role = UNION** of permissions (confirmed).
- **Super Admin** is the only role that manages users/roles (for now, confirmed).

Legend: ✅ all · 🟡 only their assigned/owned projects · ❌ none

| Capability | Super Admin | Manager | Project Manager | Developer | Designer |
|---|:--:|:--:|:--:|:--:|:--:|
| Manage users & roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Onboard / create clients | ✅ | ✅ | ✅ | ❌ | ❌ |
| View clients | ✅ | ✅ | 🟡 | 🟡 ltd | 🟡 ltd |
| Edit / delete clients | ✅ | ✅ edit | 🟡 edit | ❌ | ❌ |
| Create projects | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit projects | ✅ | ✅ | 🟡 | ❌ | ❌ |
| Delete projects | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign team to projects | ✅ | ✅ | 🟡 | ❌ | ❌ |
| View projects | ✅ | ✅ | 🟡 | 🟡 | 🟡 |
| Create / assign tasks | ✅ | ✅ | 🟡 | ❌ | ❌ |
| Update own task status | ✅ | ✅ | ✅ | ✅ | ✅ |
| View budget / financials | ✅ | ✅ | 🟡 | ❌ | ❌ |
| Log own time / check-in | ✅ | ✅ | ✅ | ✅ | ✅ |
| View others' time / reports | ✅ | ✅ | 🟡 | ❌ | ❌ |
| Comment / view files & links | ✅ | ✅ | ✅ | 🟡 | 🟡 |

Notes:
- Manager = Super Admin minus user management.
- Developer and Designer have IDENTICAL permissions (contributor tier); difference
  is discipline + which tasks they're assigned. No budget visibility.

### Still open (roles)
- Project Manager: scoped to their own projects (assumed) vs. see ALL projects?
- Project Manager budget visibility: only their projects (assumed) vs. none vs. all?
- Should Developers/Designers be able to create tasks on their assigned projects?

---

## 2. What it tracks
_TBD — clients, projects, tasks, time, etc._

---

## Client + Project Onboarding form

Creates a **Client** AND their **first Project** in one flow. Same client can get
more projects later without re-onboarding. (yours) = originally requested,
(+) = suggested addition.

**Section 1 — Client / Contact**
- Client / business name (yours)
- Primary contact name (+)
- Client email (yours)
- Client phone number (yours)
- **Source** — how they found us (yours, "where from"): Upwork / Agency / Referral
  / Other (free text). [RESOLVED: this is acquisition source, not geography]
- Industry / niche (+)
- Geographic location — country/city (+ optional, keep?)
- Current website (yours)
- Social / other links (+)

**Section 2 — Project Overview**
- Project name (yours)
- Project type (yours) — options [draft, adjust later]: Branding / Identity ·
  Logo Design · Web Design (UI/UX) · Web Development · Website (Design+Dev) ·
  E-commerce · Landing Page · Mobile App · SEO · Marketing / Ads · Social Media ·
  Maintenance / Retainer · Other
  (Figma link shows for design/dev types; domain/hosting shows for dev types)
- Project description / goals (yours)
- Target audience (+)
- References / inspiration links (+)

**Section 3 — Scope · Budget · Timeline**
- Budget [RESOLVED]: amount + currency + type (fixed / hourly / retainer)
- Start date (+)
- Deadline (yours)
- Priority: low / med / high (+)

**Section 4 — Assets & Links**  [RESOLVED: links only for v1, no file storage]
- Project files — paste links (Drive/Dropbox/etc.) (yours, as URLs)
- Figma link (yours) — conditional on project type involving design/dev
- Brand assets / guidelines link (+)
- Domain / hosting access notes (+) (dev projects)

**Section 5 — Assignment (internal)**  [RESOLVED: multiple people per role]
- Project Manager(s) (yours)
- Developer(s) (+)
- Designer(s) (+)
- Status — default "Onboarding / Planned" (+)
- Internal notes / tags (+)

### Resolved decisions (onboarding)
- "Where from" = acquisition source (Upwork / Agency / Referral / Other).
- Budget = amount + currency + type (fixed / hourly / retainer).
- Assignment = multiple people per role (PM / Dev / Designer).
- Files = links/URLs only for v1 (no upload storage yet).

### Still open (onboarding)
- Keep the optional geographic location field, or drop it? (default: keep, optional)
- Which fields are REQUIRED vs optional? (default: Client name, email, Project name,
  Project type, + at least one assignee required; rest optional)

## Client billing & payments  (built)

Each client has a profile (`/clients/[id]`) acting as a billing hub:
- **Projects = billing history**: each project's budget is treated as the amount
  billed; the profile lists all projects with their billed amounts + a total.
- **Payments**: a Payment record (amount, currency, method, date, optional
  project, note) is logged against the client. Payment history + total paid shown.
- **Summary**: Total billed vs. Total paid vs. Outstanding balance.
- Assumes one currency per client (uses the first project/payment currency).
- FUTURE: explicit invoices/milestones, per-project billed amount separate from
  budget, multi-currency totals, payment editing/deletion.

## 3. Key workflows
_TBD_

## 4. v1 must-haves vs. later
_TBD_

## 5. Slack integration
_Deferred — to discuss separately._
