import { sender } from '../sender';

export interface OutboundMessage {
  toEmail?: string | null;
  toLinkedIn?: string | null;
  toPhone?: string | null;
  leadName: string;
  subject?: string;
  body: string;
}

export interface SendResult {
  ok: boolean;
  /** True when "sending" means "queued a task for the human to do" (LinkedIn). */
  manual?: boolean;
  detail?: string;
}

export interface Channel {
  readonly name: string;
  send(msg: OutboundMessage): Promise<SendResult>;
}

/**
 * Email via Instantly.ai (used when INSTANTLY_API_KEY is set); otherwise a
 * dry-run that just reports what would send.
 * Docs: https://developer.instantly.ai/
 */
export class EmailChannel implements Channel {
  readonly name: string;
  private base = 'https://api.instantly.ai/api/v2';

  constructor(private apiKey?: string) {
    this.name = apiKey ? 'email(instantly)' : 'email(dry-run)';
  }

  async send(msg: OutboundMessage): Promise<SendResult> {
    if (!msg.toEmail) return { ok: false, detail: 'no email address' };
    if (!this.apiKey) {
      return { ok: true, detail: `dry-run → ${msg.toEmail}` };
    }
    const res = await fetch(`${this.base}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        from: sender.fromEmail,
        to: msg.toEmail,
        subject: msg.subject ?? '',
        body: { text: msg.body },
      }),
    });
    if (!res.ok) return { ok: false, detail: `Instantly ${res.status}: ${await res.text()}` };
    return { ok: true, detail: 'sent via Instantly' };
  }
}

/**
 * LinkedIn = a MANUAL task queue. No safe automated API for cold outreach, so
 * instead of sending we record the message for the user to send by hand.
 */
export class LinkedInChannel implements Channel {
  readonly name = 'linkedin(manual)';
  async send(_msg: OutboundMessage): Promise<SendResult> {
    return { ok: true, manual: true, detail: 'queued for manual send' };
  }
}

/**
 * SMS via Twilio. TCPA-gated by the engine (only routed here if smsConsent).
 * Dry-runs unless TWILIO_* env vars are set.
 */
export class SmsChannel implements Channel {
  readonly name = 'sms(twilio)';
  constructor(
    private sid?: string,
    private token?: string,
    private from?: string,
  ) {}

  async send(msg: OutboundMessage): Promise<SendResult> {
    if (!msg.toPhone) return { ok: false, detail: 'no phone number' };
    if (!this.sid || !this.token || !this.from) {
      return { ok: true, detail: `dry-run → ${msg.toPhone}` };
    }
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${this.sid}:${this.token}`).toString('base64'),
      },
      body: new URLSearchParams({ To: msg.toPhone, From: this.from, Body: msg.body }),
    });
    if (!res.ok) return { ok: false, detail: `Twilio ${res.status}: ${await res.text()}` };
    return { ok: true, detail: 'sent via Twilio' };
  }
}

export function channelFor(name: string): Channel {
  switch (name) {
    case 'email':
      return new EmailChannel(process.env.INSTANTLY_API_KEY?.trim() || undefined);
    case 'linkedin':
      return new LinkedInChannel();
    case 'sms':
      return new SmsChannel(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, process.env.TWILIO_FROM_NUMBER);
    default:
      throw new Error(`Unknown channel: ${name}`);
  }
}
