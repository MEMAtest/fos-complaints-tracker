import type { PublicDataStatus } from '@/lib/insights/types';

export type HomepageMetric = {
  label: string;
  value: string;
  helper: string;
};

export type HomepageDemoStepKey = 'search' | 'compare' | 'work' | 'report';

export type HomepageDemoStep = {
  key: HomepageDemoStepKey;
  label: string;
  title: string;
  caption: string;
  href: string;
  actionLabel: string;
  eyebrow: string;
  metrics: HomepageMetric[];
  bullets: string[];
  previewRows: Array<{
    label: string;
    value: string;
    tone?: 'neutral' | 'positive' | 'accent';
  }>;
};

export type HomepageStoryStep = {
  key: string;
  stage: string;
  title: string;
  body: string;
  bullets: string[];
  href: string;
  ctaLabel: string;
  accentMetric: string;
};

export type HomepageAudienceCard = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  href: string;
  ctaLabel: string;
  tone: 'light' | 'dark';
};

export type HomepageSnapshot = {
  status: PublicDataStatus;
  hero: {
    eyebrow: string;
    title: string;
    dek: string;
    primaryCta: {
      label: string;
      href: string;
    };
    secondaryCta: {
      label: string;
      href: string;
    };
    trustPoints: string[];
  };
  liveProof: HomepageMetric[];
  demoSteps: HomepageDemoStep[];
  storySteps: HomepageStoryStep[];
  audienceCards: HomepageAudienceCard[];
  featuredLinks: Array<{
    title: string;
    href: string;
    description: string;
    tag: string;
  }>;
  updatedAt: string | null;
};
