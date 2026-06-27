/**
 * Outreach sequences — one per ICP segment. Each is a series of timed touches
 * across channels. Bodies support {{tokens}}: firstName, lastName, company,
 * title, senderName, senderCompany, calendarLink, portfolioLink.
 *
 * These are STARTING DRAFTS — short, specific, low-pressure (what gets replies).
 * delayDays = days to wait AFTER the previous step. Step 1 = delay 0.
 */

export type StepChannel = 'email' | 'linkedin' | 'sms';

export interface StepDef {
  channel: StepChannel;
  delayDays: number;
  subject?: string;
  body: string;
}

export interface SequenceDef {
  key: string; // must match an ICP segment key
  name: string;
  steps: StepDef[];
}

export const sequences: SequenceDef[] = [
  {
    key: 'startups',
    name: 'Startups — MVP / product build',
    steps: [
      {
        channel: 'email',
        delayDays: 0,
        subject: "shipping {{company}}'s v1",
        body: `Hi {{firstName}},

I build polished v1 products for early-stage startups — design + development under one roof, so founders ship in weeks instead of stitching together freelancers.

Saw {{company}} and figured it might be worth a quick look. If getting a clean, investor-ready product out faster would help right now, I'd love to show you a couple of recent builds: {{portfolioLink}}

Worth a 15-min call? {{calendarLink}}

{{senderName}}
{{senderCompany}}`,
      },
      {
        channel: 'linkedin',
        delayDays: 2,
        body: `Hi {{firstName}} — just sent you a note about helping {{company}} ship its product faster. Big fan of what you're building. Open to connecting?`,
      },
      {
        channel: 'email',
        delayDays: 3,
        subject: 're: shipping {{company}}\'s v1',
        body: `Hi {{firstName}},

Quick follow-up — I know inbound is noisy. The short version: I take startup ideas from Figma to shipped, fast, with design and dev handled together.

If timing's off, no worries. If it's not, here's my calendar: {{calendarLink}}

{{senderName}}`,
      },
      {
        channel: 'email',
        delayDays: 5,
        subject: 'closing the loop',
        body: `Hi {{firstName}},

I'll stop here so I'm not cluttering your inbox. If building or rebuilding {{company}}'s product ever moves up the list, just reply and I'll jump in.

Wishing you a great launch,
{{senderName}}`,
      },
    ],
  },
  {
    key: 'ecommerce',
    name: 'E-commerce — Shopify & CRO',
    steps: [
      {
        channel: 'email',
        delayDays: 0,
        subject: "{{company}}'s store + conversion",
        body: `Hi {{firstName}},

I design and build high-converting Shopify stores for DTC brands — fast, premium, and built to lift conversion rate.

Took a quick look at {{company}} and spotted a couple of things that might be leaving revenue on the table. Happy to share them, no strings.

Worth a quick chat? {{calendarLink}}  •  Recent work: {{portfolioLink}}

{{senderName}}
{{senderCompany}}`,
      },
      {
        channel: 'linkedin',
        delayDays: 2,
        body: `Hi {{firstName}} — sent you a note with a couple of conversion ideas for {{company}}'s store. Would love to connect.`,
      },
      {
        channel: 'email',
        delayDays: 3,
        subject: 're: {{company}}\'s store + conversion',
        body: `Hi {{firstName}},

Following up — the two quick wins I mentioned for {{company}} were around your product page and checkout flow. Small changes, real impact on revenue.

Want me to send them over, or easier to talk? {{calendarLink}}

{{senderName}}`,
      },
      {
        channel: 'email',
        delayDays: 5,
        subject: 'closing the loop',
        body: `Hi {{firstName}},

Last note from me — I'll get out of your inbox. If a store redesign or a conversion push lands on your roadmap, reply here and I'll send the ideas straight over.

Cheers,
{{senderName}}`,
      },
    ],
  },
  {
    key: 'agencies',
    name: 'Agencies — white-label dev overflow',
    steps: [
      {
        channel: 'email',
        delayDays: 0,
        subject: 'white-label dev for {{company}}',
        body: `Hi {{firstName}},

I work white-label with agencies like {{company}} — picking up design + development overflow so you can say yes to more projects without hiring.

Reliable, on-brand, and invisible to your clients. If you ever have more work than hands, I'm a good safety valve.

Recent builds: {{portfolioLink}}  •  Quick intro call? {{calendarLink}}

{{senderName}}
{{senderCompany}}`,
      },
      {
        channel: 'linkedin',
        delayDays: 2,
        body: `Hi {{firstName}} — reached out about being a white-label design/dev partner for {{company}}'s overflow. Worth connecting?`,
      },
      {
        channel: 'email',
        delayDays: 3,
        subject: 're: white-label dev for {{company}}',
        body: `Hi {{firstName}},

Circling back. Most agencies I partner with keep me on call for the busy months — no retainer, just there when you need an extra senior pair of hands.

Happy to set up a quick intro so I'm in your back pocket: {{calendarLink}}

{{senderName}}`,
      },
      {
        channel: 'email',
        delayDays: 5,
        subject: 'closing the loop',
        body: `Hi {{firstName}},

I'll leave it here. If {{company}} ever needs overflow design/dev capacity, reply and we'll set up a quick call.

Best,
{{senderName}}`,
      },
    ],
  },
  {
    key: 'local-smb',
    name: 'Local SMB — website rebuild',
    steps: [
      {
        channel: 'email',
        delayDays: 0,
        subject: "quick note on {{company}}'s website",
        body: `Hi {{firstName}},

I design and build websites for businesses like {{company}} — fast, modern, mobile-friendly, and set up to actually bring in customers (not just look nice).

Had a quick look at your current site and noticed a few things worth tightening up. Happy to walk you through them, free.

Recent work: {{portfolioLink}}  •  Grab a time: {{calendarLink}}

{{senderName}}
{{senderCompany}}`,
      },
      {
        channel: 'linkedin',
        delayDays: 2,
        body: `Hi {{firstName}} — sent {{company}} a note about giving the website a refresh. Would be glad to connect.`,
      },
      {
        channel: 'email',
        delayDays: 4,
        subject: 're: {{company}}\'s website',
        body: `Hi {{firstName}},

Just following up. A clean, fast website usually pays for itself in a few extra enquiries a month — and I make the whole process painless.

Want me to send over the quick notes I made, or easier to chat? {{calendarLink}}

{{senderName}}`,
      },
      {
        channel: 'email',
        delayDays: 5,
        subject: 'closing the loop',
        body: `Hi {{firstName}},

Last one from me. If refreshing {{company}}'s website ever moves up the list, just reply and I'll take it from there.

Thanks,
{{senderName}}`,
      },
    ],
  },
];

export function getSequenceDef(key: string): SequenceDef | undefined {
  return sequences.find((s) => s.key === key);
}
