import type { Segment } from '../icp';
import type { LeadSource, SourcedLead } from './types';

/**
 * A fake data source so the pipeline runs end-to-end before an APOLLO_API_KEY
 * is configured. Generates plausible, segment-distinct leads.
 */
export class MockSource implements LeadSource {
  readonly name = 'mock';

  async search(icp: Segment, limit: number): Promise<SourcedLead[]> {
    const firstNames = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie'];
    const lastNames = ['Lee', 'Patel', 'Garcia', 'Khan', 'Nguyen', 'Smith', 'Brown', 'Davis'];
    const companies = ['Northwind Co', 'Brightleaf', 'Harbor Studio', 'Vellum', 'Oakline', 'Pinemark', 'Cobalt Labs', 'Driftwood'];
    const titles = icp.targetTitles.length ? icp.targetTitles : ['Founder', 'CEO'];

    const out: SourcedLead[] = [];
    for (let i = 0; i < limit; i++) {
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[(i * 3) % lastNames.length];
      const co = companies[i % companies.length];
      const domain = co.toLowerCase().replace(/[^a-z]/g, '') + '.com';
      out.push({
        externalId: `mock-${icp.key}-${i}-${domain}`,
        firstName: fn,
        lastName: ln,
        title: titles[i % titles.length],
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}.${icp.key}${i}@${domain}`,
        emailStatus: i % 4 === 0 ? 'risky' : 'verified',
        linkedinUrl: `https://linkedin.com/in/${fn.toLowerCase()}-${ln.toLowerCase()}`,
        company: {
          name: co,
          domain,
          industry: icp.industries[0] ?? 'Software',
          employeeCount: icp.employeeRange.min + ((i * 7) % Math.max(1, icp.employeeRange.max - icp.employeeRange.min)),
          location: icp.locations[0] ?? 'United States',
          linkedinUrl: `https://linkedin.com/company/${domain.replace('.com', '')}`,
        },
      });
    }
    return out;
  }
}
