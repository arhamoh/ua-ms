// Welcome email for a newly-added team member: their credentials + a short,
// role-aware guide to what they can do in Keel. Sending is gated behind
// WELCOME_EMAILS_ENABLED so we can build/preview it while still in development
// without actually emailing anyone.

import { randomBytes, randomInt } from 'crypto';
import { sendEmail, emailConfigured } from '@/lib/email';
import { AREAS, ROLE_DESCRIPTIONS, roleLabel, roleCanAccess, type Role } from '@/lib/permissions';

/** Turn on real sending by setting WELCOME_EMAILS_ENABLED=true. Off by default. */
export function welcomeEmailsEnabled(): boolean {
  return process.env.WELCOME_EMAILS_ENABLED === 'true';
}

/** Where members sign in. Set APP_URL in production; falls back to Railway's domain. */
export function appLoginUrl(): string {
  const base =
    process.env.APP_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
    'https://your-keel-app.example.com';
  return `${base.replace(/\/$/, '')}/login`;
}

/** A readable temporary password, e.g. "keel-7fq3-92kt". Easy to type once. */
export function generateTempPassword(): string {
  const chunk = () => randomBytes(2).toString('hex'); // 4 hex chars
  return `keel-${chunk()}-${chunk()}`;
}

/** Derive a login handle from the email local-part (letters/digits/dots only). */
export function usernameFromEmail(email: string): string {
  const local = (email.split('@')[0] ?? '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  return local || `member${randomInt(1000, 9999)}`;
}

// The areas a set of roles can reach, as human labels — the guide's checklist.
function accessibleAreas(roles: string[]): string[] {
  return AREAS.filter((a) => a.roles === 'all' || roles.some((r) => roleCanAccess(r, a))).map(
    (a) => a.label,
  );
}

export interface WelcomeEmailInput {
  name: string;
  username: string;
  tempPassword: string;
  roles: string[];
  loginUrl?: string;
}

/** Build the welcome email — subject + HTML. Pure; does not send. */
export function buildWelcomeEmail(input: WelcomeEmailInput): { subject: string; html: string } {
  const loginUrl = input.loginUrl ?? appLoginUrl();
  const roleNames = input.roles.length ? input.roles.map((r) => roleLabel(r)).join(', ') : 'Team member';
  const roleBlurbs = input.roles
    .map((r) => ROLE_DESCRIPTIONS[r as Role])
    .filter(Boolean) as string[];
  const areas = accessibleAreas(input.roles);

  const subject = `Welcome to Keel — your login details`;

  const areaItems = areas
    .map(
      (a) =>
        `<li style="margin:2px 0;color:#334155;font-size:14px;">${escapeHtml(a)}</li>`,
    )
    .join('');

  const roleItems = roleBlurbs
    .map(
      (b) =>
        `<li style="margin:4px 0;color:#475569;font-size:14px;line-height:1.5;">${escapeHtml(b)}</li>`,
    )
    .join('');

  const html = `
  <div style="background:#f1f5f9;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:#0f5132;padding:24px 28px;">
        <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">keel.</span>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Welcome, ${escapeHtml(input.name)} 👋</h1>
        <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
          An account has been created for you on <strong>Keel</strong>, our agency operations platform.
          You've been added as <strong>${escapeHtml(roleNames)}</strong>. Here's how to get in and what you can do.
        </p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:22px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">Your login</p>
          <p style="margin:0 0 6px;font-size:14px;color:#334155;"><strong>Username:</strong> ${escapeHtml(input.username)}</p>
          <p style="margin:0 0 6px;font-size:14px;color:#334155;"><strong>Temporary password:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${escapeHtml(input.tempPassword)}</code></p>
          <p style="margin:12px 0 0;">
            <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#0f5132;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px;">Sign in to Keel</a>
          </p>
          <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">
            You can sign in with your username or your email. Please change your password from
            <em>Settings</em> right after your first sign-in.
          </p>
        </div>

        ${
          roleItems
            ? `<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#0f172a;">Your role</p>
               <ul style="margin:0 0 18px;padding-left:18px;">${roleItems}</ul>`
            : ''
        }

        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#0f172a;">What you can access</p>
        <ul style="margin:0 0 18px;padding-left:18px;">${areaItems}</ul>

        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#0f172a;">Getting started</p>
        <ol style="margin:0 0 8px;padding-left:18px;color:#475569;font-size:14px;line-height:1.6;">
          <li>Sign in with the details above.</li>
          <li>Open <em>Settings</em> and set your own password (and timezone).</li>
          <li>Use the left sidebar to move between areas. If something's missing, it's not part of your role — ask an admin.</li>
        </ol>

        <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
          Didn't expect this email? Let your team admin know and ignore it — the account can be removed.
        </p>
      </div>
    </div>
  </div>`;

  return { subject, html };
}

/**
 * Send the welcome email — but only when WELCOME_EMAILS_ENABLED=true AND email
 * is configured. Otherwise it's a no-op (returns sent:false) so creating a
 * member never fails just because email is off during development.
 */
export async function sendWelcomeEmail(
  to: string,
  input: WelcomeEmailInput,
): Promise<{ sent: boolean; reason?: string }> {
  if (!welcomeEmailsEnabled()) return { sent: false, reason: 'disabled' };
  if (!emailConfigured()) return { sent: false, reason: 'email-not-configured' };
  const { subject, html } = buildWelcomeEmail(input);
  const res = await sendEmail({ to, subject, html });
  return res.ok ? { sent: true } : { sent: false, reason: res.error };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
