import type { Segment } from '../icp';

/** A raw lead as returned by a data provider, before we store it. */
export interface SourcedLead {
  externalId?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  email?: string;
  emailStatus?: 'unknown' | 'verified' | 'risky' | 'invalid';
  phone?: string;
  linkedinUrl?: string;
  company?: {
    name: string;
    domain?: string;
    industry?: string;
    employeeCount?: number;
    location?: string;
    linkedinUrl?: string;
  };
}

/**
 * Any lead data provider implements this. Swap Apollo for Hunter, People Data
 * Labs, etc. without touching the rest of the system.
 */
export interface LeadSource {
  readonly name: string;
  search(segment: Segment, limit: number): Promise<SourcedLead[]>;
}
