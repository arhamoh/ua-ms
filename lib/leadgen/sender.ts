/**
 * Who outreach comes from. Pulled from env so it's configured per-deployment.
 * The mailing address is LEGALLY REQUIRED in every commercial email (CAN-SPAM).
 *
 * Set these in the environment (Railway): OUTREACH_FROM_NAME, OUTREACH_COMPANY,
 * OUTREACH_CALENDAR_LINK, OUTREACH_PORTFOLIO_LINK, OUTREACH_FROM_EMAIL,
 * OUTREACH_MAILING_ADDRESS.
 */
export const sender = {
  name: process.env.OUTREACH_FROM_NAME ?? 'UA Digital',
  company: process.env.OUTREACH_COMPANY ?? 'UA Digital',
  calendarLink: process.env.OUTREACH_CALENDAR_LINK ?? 'https://cal.com/ua-digital',
  portfolioLink: process.env.OUTREACH_PORTFOLIO_LINK ?? 'https://uadigital.example',
  fromEmail: process.env.OUTREACH_FROM_EMAIL ?? 'hello@uadigital.example',
  mailingAddress: process.env.OUTREACH_MAILING_ADDRESS ?? 'UA Digital, Address line, City, Country',
};

export type Sender = typeof sender;
