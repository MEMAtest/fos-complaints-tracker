import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/insights/seo';
import { getAppHref } from '@/lib/marketing/config';
import { getHomepageSnapshot } from '@/lib/marketing/homepage-repository';
import { FooterCta } from '@/components/marketing/footer-cta';
import { HomepageHero } from '@/components/marketing/homepage-hero';
import { HowItWorksStory } from '@/components/marketing/how-it-works-story';
import { LiveLinksGrid } from '@/components/marketing/live-links-grid';
import { LiveProofStrip } from '@/components/marketing/live-proof-strip';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { ExpectationsSection } from '@/components/marketing/expectations-section';
import { ProductSurfaceGrid } from '@/components/marketing/product-surface-grid';

export const metadata: Metadata = {
  title: 'FOS Complaints Intelligence | Live Complaint Data, Workspace, and Board Reporting',
  description:
    'Explore live Financial Ombudsman complaint intelligence by year, firm, product, and theme, then move into the complaints workspace for evidence, letters, approvals, and board-ready reporting.',
  alternates: { canonical: absoluteUrl('/') },
  openGraph: {
    title: 'FOS Complaints Intelligence | Live Complaint Data, Workspace, and Board Reporting',
    description:
      'Explore live Financial Ombudsman complaint intelligence by year, firm, product, and theme, then move into the complaints workspace for evidence, letters, approvals, and board-ready reporting.',
    url: absoluteUrl('/'),
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FOS Complaints Intelligence',
    description:
      'Live complaint data, comparison, complaint handling workflow, and board-ready reporting in one platform.',
  },
};

export default async function MarketingHomepage() {
  const snapshot = await getHomepageSnapshot();
  const workspaceHref = getAppHref('/');
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'FOS Complaints Intelligence',
        url: absoluteUrl('/'),
        description: metadata.description,
      },
      {
        '@type': 'SoftwareApplication',
        name: 'FOS Complaints Intelligence',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: absoluteUrl('/'),
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/InStock',
        },
        featureList: [
          'Live public complaints intelligence',
          'Firm and product comparison',
          'Complaints workspace',
          'Board-ready reporting',
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f7fbff] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <MarketingHeader />
      <main>
        <HomepageHero snapshot={snapshot} />
        <LiveProofStrip metrics={snapshot.liveProof} updatedAt={snapshot.updatedAt} />
        <HowItWorksStory steps={snapshot.storySteps} />
        <ProductSurfaceGrid surfaces={snapshot.surfaces} />
        <ExpectationsSection expectations={snapshot.expectations} />
        <LiveLinksGrid links={snapshot.featuredLinks} />
      </main>
      <FooterCta workspaceHref={workspaceHref} />
    </div>
  );
}
