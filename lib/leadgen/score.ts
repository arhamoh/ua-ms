import type { Segment } from './icp';

interface ScorableLead {
  title?: string | null;
  emailStatus?: string | null;
  company?: {
    industry?: string | null;
    employeeCount?: number | null;
    location?: string | null;
  } | null;
}

/**
 * Score a lead 0-100 for how well it fits the given segment. Higher = contact
 * first. Pure function — easy to test and tune.
 */
export function scoreLead(lead: ScorableLead, icp: Segment): number {
  const w = icp.weights;
  let score = 0;

  if (lead.title) {
    const t = lead.title.toLowerCase();
    if (icp.targetTitles.some((tt) => t.includes(tt.toLowerCase()))) score += w.titleMatch;
  }

  if (icp.industries.length && lead.company?.industry) {
    const ind = lead.company.industry.toLowerCase();
    if (icp.industries.some((i) => ind.includes(i.toLowerCase()))) score += w.industryMatch;
  } else if (!icp.industries.length) {
    score += w.industryMatch * 0.5;
  }

  const emp = lead.company?.employeeCount ?? undefined;
  if (emp !== undefined && emp !== null) {
    if (emp >= icp.employeeRange.min && emp <= icp.employeeRange.max) {
      score += w.sizeMatch;
    } else {
      const dist = emp < icp.employeeRange.min ? icp.employeeRange.min - emp : emp - icp.employeeRange.max;
      score += Math.max(0, w.sizeMatch * (1 - dist / icp.employeeRange.max));
    }
  }

  if (icp.locations.length && lead.company?.location) {
    const loc = lead.company.location.toLowerCase();
    if (icp.locations.some((l) => loc.includes(l.toLowerCase()))) score += w.locationMatch;
  } else if (!icp.locations.length) {
    score += w.locationMatch * 0.5;
  }

  if (lead.emailStatus === 'verified') score += w.hasVerifiedEmail;

  return Math.round(Math.min(100, score));
}
