export type InsightKind = 'year' | 'firm' | 'product' | 'type';

export type InsightArchiveItem = {
  kind: InsightKind;
  slug: string;
  entityKey: string;
  title: string;
  href: string;
  totalCases: number;
  upheldRate: number | null;
  latestDecisionDate: string | null;
  summary: string;
  highlight: string;
};

export type InsightMetric = {
  label: string;
  value: string;
  helper?: string;
};

export type InsightNarrativeSection = {
  key: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type InsightRankedItem = {
  label: string;
  value: number;
  valueLabel: string;
  helper?: string;
  href?: string;
};

export type InsightRankedListSection = {
  key: string;
  title: string;
  description: string;
  items: InsightRankedItem[];
};

export type InsightFaqItem = {
  question: string;
  answer: string;
};

export type InsightRelatedLink = {
  title: string;
  href: string;
  description: string;
};

export type InsightRepresentativeCase = {
  caseId: string;
  decisionReference: string;
  firmName: string | null;
  productGroup: string | null;
  outcome: string;
  decisionDate: string | null;
  summary: string | null;
  sourceUrl: string | null;
  pdfUrl: string | null;
};

export type InsightPageData = {
  kind: InsightKind;
  slug: string;
  entityKey: string;
  title: string;
  description: string;
  canonicalPath: string;
  hero: {
    eyebrow: string;
    title: string;
    dek: string;
  };
  metrics: InsightMetric[];
  sections: InsightNarrativeSection[];
  rankedLists: InsightRankedListSection[];
  representativeCases: InsightRepresentativeCase[];
  faq: InsightFaqItem[];
  relatedLinks: InsightRelatedLink[];
  breadcrumbs: Array<{ title: string; href: string }>;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  lastUpdated: string | null;
};

export type InsightLandingData = {
  hero: {
    eyebrow: string;
    title: string;
    dek: string;
  };
  metrics: InsightMetric[];
  featured: Array<{
    title: string;
    href: string;
    description: string;
  }>;
  collections: Array<{
    title: string;
    href: string;
    description: string;
    items: InsightArchiveItem[];
  }>;
  lastUpdated: string | null;
};
