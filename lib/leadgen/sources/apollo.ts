import type { Segment } from '../icp';
import type { LeadSource, SourcedLead } from './types';

/**
 * Apollo.io data source — TWO-STEP flow, because Apollo's search endpoint does
 * NOT return emails:
 *   1. SEARCH  (POST /mixed_people/api_search) — finds people. No credits, no email.
 *   2. ENRICH  (POST /people/bulk_match, up to 10 at a time) — reveals email +
 *      full firmographics. Consumes credits, so we only enrich up to `limit`.
 *
 * Docs: https://docs.apollo.io/reference/people-api-search
 *       https://docs.apollo.io/reference/bulk-people-enrichment
 */
export class ApolloSource implements LeadSource {
  readonly name = 'apollo';
  private base = 'https://api.apollo.io/api/v1';

  constructor(
    private apiKey: string,
    private revealEmails = true,
  ) {}

  async search(segment: Segment, limit: number): Promise<SourcedLead[]> {
    const people = await this.searchPeople(segment, limit);
    if (!people.length) return [];
    if (this.revealEmails) await this.enrichInPlace(people);
    return people.map(mapPerson);
  }

  private async searchPeople(segment: Segment, limit: number): Promise<ApolloPerson[]> {
    const perPage = Math.min(limit, 100);
    const res = await fetch(`${this.base}/mixed_people/api_search`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        person_titles: segment.targetTitles,
        organization_num_employees_ranges: [`${segment.employeeRange.min},${segment.employeeRange.max}`],
        ...(segment.locations.length ? { person_locations: segment.locations } : {}),
        ...(segment.industries.length ? { q_organization_keyword_tags: segment.industries } : {}),
        page: 1,
        per_page: perPage,
      }),
    });
    if (!res.ok) throw new Error(`Apollo search error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { people?: ApolloPerson[] };
    return (data.people ?? []).slice(0, limit);
  }

  private async enrichInPlace(people: ApolloPerson[]): Promise<void> {
    for (let i = 0; i < people.length; i += 10) {
      const batch = people.slice(i, i + 10);
      const res = await fetch(`${this.base}/people/bulk_match`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          reveal_personal_emails: true,
          details: batch.map((p) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            organization_name: p.organization?.name,
            domain: p.organization?.website_url?.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
          })),
        }),
      });
      if (!res.ok) {
        console.warn(`Apollo enrich batch failed (${res.status}): ${await res.text()}`);
        continue;
      }
      const data = (await res.json()) as { matches?: (ApolloPerson | null)[] };
      const matches = data.matches ?? [];
      batch.forEach((p, j) => {
        const m = matches[j];
        if (!m) return;
        p.email = m.email ?? p.email;
        p.email_status = m.email_status ?? p.email_status;
        p.linkedin_url = m.linkedin_url ?? p.linkedin_url;
        p.title = p.title ?? m.title;
        if (m.organization) p.organization = { ...p.organization, ...m.organization };
      });
    }
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': this.apiKey,
    };
  }
}

interface ApolloPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  email_status?: string;
  linkedin_url?: string;
  organization?: {
    name?: string;
    website_url?: string;
    industry?: string;
    estimated_num_employees?: number;
    city?: string;
    country?: string;
    linkedin_url?: string;
  };
}

function mapPerson(p: ApolloPerson): SourcedLead {
  const org = p.organization;
  const domain = org?.website_url?.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const email = p.email && !p.email.includes('email_not_unlocked') ? p.email : undefined;
  return {
    externalId: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    title: p.title,
    email,
    emailStatus: normalizeEmailStatus(p.email_status),
    linkedinUrl: p.linkedin_url,
    company: org?.name
      ? {
          name: org.name,
          domain,
          industry: org.industry,
          employeeCount: org.estimated_num_employees,
          location: [org.city, org.country].filter(Boolean).join(', ') || undefined,
          linkedinUrl: org.linkedin_url,
        }
      : undefined,
  };
}

function normalizeEmailStatus(s?: string): SourcedLead['emailStatus'] {
  switch (s) {
    case 'verified':
      return 'verified';
    case 'unverified':
    case 'guessed':
      return 'risky';
    case 'unavailable':
      return 'invalid';
    default:
      return 'unknown';
  }
}
