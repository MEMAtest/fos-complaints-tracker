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
  accentMetric: string;
};

export type HomepageSurface = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  href: string;
  metric: string;
};

export type HomepageExpectation = {
  title: string;
  body: string;
};

export type HomepageSnapshot = {
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
  };
  liveProof: HomepageMetric[];
  demoSteps: HomepageDemoStep[];
  storySteps: HomepageStoryStep[];
  surfaces: HomepageSurface[];
  expectations: HomepageExpectation[];
  featuredLinks: Array<{
    title: string;
    href: string;
    description: string;
    tag: string;
  }>;
  updatedAt: string | null;
};
