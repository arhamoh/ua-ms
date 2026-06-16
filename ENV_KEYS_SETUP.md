# UA Digital — Environment Keys Setup

This is the full list of keys/credentials to add so the integrations turn on.
Each integration shows a "not configured" notice until its keys are set, so
nothing breaks if you skip one.

App is live at: **https://uadigital-pm.up.railway.app**

---

## How to add a key to Railway (do this for each variable below)

1. Go to **https://railway.app** → open your **happy-heart** project
2. Click the **`ua-ms`** service → **Variables** tab
3. **+ New Variable** → enter the **Name** and **Value** → save
4. Railway **auto-redeploys**. Done.

> Tip: For multi-line values (the Google JSON), use Railway's **Raw Editor**.

---

## Quick checklist

- [ ] `AUTH_SECRET` — auth security
- [ ] Google Drive — `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHARED_DRIVE_ID`
- [ ] Email — **either** Gmail SMTP **or** Resend (not both)
- [ ] **AI features** — `OPENROUTER_API_KEY` (powers the analytics chatbot **and**
      "Scan a bill" photo OCR **and** PDF statement import). Optional model overrides:
      `OPENROUTER_MODEL`, `OPENROUTER_VISION_MODEL`.

> `DATABASE_URL` is already set by Railway — leave it alone. Nothing else
> (time tracking, commissions, loans, statement CSV import, etc.) needs a key.

---

## 1. Auth security (recommended)

| Name | Value |
|------|-------|
| `AUTH_SECRET` | `e6Ml0tjXPFqN3DAIkcJZ7euv2W/ldvm6Plujulj7OKA=` |

After adding, everyone is logged out once and signs in again — that's normal.
(To generate a fresh one instead: `openssl rand -base64 32`.)

---

## 2. Google Shared Drive (file uploads)

**Steps:**
1. Go to **https://console.cloud.google.com** → create/select a project
2. **APIs & Services → Library** → search **"Google Drive API"** → **Enable**
3. **IAM & Admin → Service Accounts → Create service account** → name it (e.g. `ua-drive`) → Done
4. Click the service account → **Keys → Add key → Create new key → JSON** → a `.json` file downloads
5. Copy the service account **email** (looks like `ua-drive@yourproject.iam.gserviceaccount.com`)
6. In Google Drive, open your **Shared Drive** → **Manage members** → add that email as **Content manager**
7. Get the **Shared Drive ID**: open the Shared Drive — the URL is
   `drive.google.com/drive/folders/XXXXXXXX` → `XXXXXXXX` is the ID

**Add to Railway:**

| Name | Value |
|------|-------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | paste the **entire contents** of the downloaded `.json` file |
| `GOOGLE_SHARED_DRIVE_ID` | the ID from step 7 |

Uploads land in your Shared Drive organized as: **Client - Project / Type**.

---

## 3. Invoice & receipt emails — pick ONE option

### Option A — Gmail / SMTP (easiest with GSuite)
1. On the Google account, enable **2-Step Verification**
2. **https://myaccount.google.com → Security → App passwords** → create one for "Mail" → copy the 16-character password

| Name | Value |
|------|-------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | your full email address |
| `SMTP_PASS` | the 16-char app password |
| `SMTP_FROM` | your email address |

### Option B — Resend
1. **https://resend.com** → API Keys → create → copy (`re_...`)
2. Verify your sending domain in Resend

| Name | Value |
|------|-------|
| `RESEND_API_KEY` | `re_...` |
| `INVOICE_FROM_EMAIL` | `invoices@yourdomain.com` (on the verified domain) |

> If both SMTP and Resend are set, SMTP is used.

---

## 4. AI features (OpenRouter) — chatbot, bill scanning, PDF statements

One key turns on **three** things:

- **Analytics chatbot** (Assistant) — uses a text model
- **"Scan a bill"** (Finance → Expenses → Scan a bill) — reads a photo of a bill
  with a **vision** model and fills in the amount/date/vendor
- **PDF statement import** (Finance → Expenses → Import statement) — reads a
  bank/credit-card **PDF** and extracts the transactions (text model)

**Setup:**
1. **https://openrouter.ai** → sign up → **Keys** → create key → copy (`sk-or-...`)
2. Add a little credit (pay-per-use; bills/statements are a few cents each)

| Name | Value | Required? |
|------|-------|-----------|
| `OPENROUTER_API_KEY` | `sk-or-...` | **Yes** — without it, all three show a "not configured" notice |
| `OPENROUTER_MODEL` | `moonshotai/kimi-k2` | Optional — text model for chatbot + PDF statements (this is the default) |
| `OPENROUTER_VISION_MODEL` | `google/gemini-2.0-flash-001` | Optional — **vision** model for "Scan a bill". Must be a vision-capable model. This is the default; only set it to override |

> Note: the chatbot's Kimi model is **text-only**, so bill-photo OCR uses the
> separate vision model above. The default works out of the box — you only need
> `OPENROUTER_API_KEY`. CSV statement import needs **no key** (parsed locally);
> only PDF statements and bill photos call OpenRouter.

---

## Notes

- The Railway Postgres `DATABASE_URL` is already configured — don't change it.
- After adding keys, hit the **↻ hard-refresh** button in the app header if the
  PWA shows a cached older version.
- Also worth doing once: **Settings → Company details** (name, GST/QST/NEQ
  numbers, tax rates) so invoices/receipts/contracts carry the right info.
- Every integration is **optional and gated** — anything without its key simply
  shows a "not configured" message instead of breaking.
