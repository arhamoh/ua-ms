/**
 * Ideal Customer Profile (ICP), split into SEGMENTS — one niche each.
 *
 * Each segment drives both what gets sourced (the Apollo query) and how leads
 * are scored. Source all segments, but run OUTREACH one at a time with copy
 * written for that niche. Recommended order to work them is by `priority`.
 */

export interface Segment {
  key: string;
  label: string;
  priority: number;

  targetTitles: string[];
  industries: string[];
  employeeRange: { min: number; max: number };
  locations: string[];

  weights: {
    titleMatch: number;
    industryMatch: number;
    sizeMatch: number;
    locationMatch: number;
    hasVerifiedEmail: number;
  };
}

const defaultWeights = {
  titleMatch: 30,
  industryMatch: 25,
  sizeMatch: 20,
  locationMatch: 15,
  hasVerifiedEmail: 10,
};

export const segments: Segment[] = [
  {
    key: 'startups',
    label: 'Funded startups — MVP / product builds',
    priority: 1,
    targetTitles: ['Founder', 'Co-Founder', 'CEO', 'CTO', 'Head of Product'],
    industries: ['Software', 'Information Technology', 'Internet', 'SaaS'],
    employeeRange: { min: 2, max: 50 },
    locations: ['United States', 'United Kingdom', 'Canada'],
    weights: { ...defaultWeights, titleMatch: 35 },
  },
  {
    key: 'ecommerce',
    label: 'E-commerce / DTC brands — Shopify & CRO',
    priority: 2,
    targetTitles: ['Founder', 'CEO', 'Owner', 'Ecommerce Manager', 'Head of Ecommerce'],
    industries: ['Retail', 'Consumer Goods', 'Apparel & Fashion', 'Cosmetics', 'Health, Wellness & Fitness'],
    employeeRange: { min: 5, max: 100 },
    locations: ['United States', 'United Kingdom', 'Canada', 'Australia'],
    weights: defaultWeights,
  },
  {
    key: 'agencies',
    label: 'Agencies — white-label dev overflow',
    priority: 3,
    targetTitles: ['Founder', 'CEO', 'Owner', 'Managing Director', 'Creative Director'],
    industries: ['Marketing & Advertising', 'Design', 'Public Relations & Communications'],
    employeeRange: { min: 5, max: 50 },
    locations: ['United States', 'United Kingdom', 'Canada'],
    weights: { ...defaultWeights, industryMatch: 30 },
  },
  {
    key: 'local-smb',
    label: 'Local SMBs — outdated website rebuilds',
    priority: 4,
    targetTitles: ['Owner', 'Founder', 'President', 'General Manager'],
    industries: ['Construction', 'Real Estate', 'Hospitality', 'Health, Wellness & Fitness', 'Professional Services'],
    employeeRange: { min: 5, max: 200 },
    locations: ['United States'],
    weights: { ...defaultWeights, locationMatch: 25, titleMatch: 25 },
  },
];

export function getSegment(key: string): Segment | undefined {
  return segments.find((s) => s.key === key);
}
