import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/insights/seo';
import { getWorkspaceEntryHref } from '@/lib/marketing/config';
import { getHomepageSnapshot } from '@/lib/marketing/homepage-repository';
import { AudienceSplit } from '@/components/marketing/audience-split';
import { FooterCta } from '@/components/marketing/footer-cta';
import { HomepageHero } from '@/components/marketing/homepage-hero';
import { LiveProofStrip } from '@/components/marketing/live-proof-strip';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { PhaseGrid } from '@/components/marketing/phase-grid';
import { PublicStatusBanner } from '@/components/public/public-status-banner';

export const metadata: Metadata = {
  title: 'RegComplaints | FOS Complaints Intelligence, Evidence & Board Reporting',
  description:
    'Ombudsman insight. Decisive resolution. Explore source-backed Financial Ombudsman complaint intelligence by year, firm, product, and theme, then move into the complaints workspace for evidence, letters, approvals, and board-ready reporting.',
  alternates: { canonical: absoluteUrl('/') },
  openGraph: {
    title: 'RegComplaints | FOS Complaints Intelligence, Evidence & Board Reporting',
    description:
      'Ombudsman insight. Decisive resolution. Explore source-backed Financial Ombudsman complaint intelligence by year, firm, product, and theme, then move into the complaints workspace for evidence, letters, approvals, and board-ready reporting.',
    url: absoluteUrl('/'),
    siteName: 'RegComplaints',
    type: 'website',
    images: [
      {
        url: absoluteUrl('/images/brand/regcomplaints-og.png'),
        width: 1200,
        height: 630,
        alt: 'RegComplaints - ombudsman insight. Decisive resolution.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RegComplaints | FOS Complaints Intelligence',
    description:
      'Ombudsman insight. Decisive resolution. Source-backed complaint data, comparison, complaint handling workflow, and board-ready reporting in one platform.',
    images: [absoluteUrl('/images/brand/regcomplaints-og.png')],
  },
};

export default async function MarketingHomepage() {
  const snapshot = await getHomepageSnapshot();
  const workspaceHref = getWorkspaceEntryHref();
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'RegComplaints',
        url: absoluteUrl('/'),
        logo: absoluteUrl('/regcomplaints-mark.png'),
      },
      {
        '@type': 'WebSite',
        name: 'RegComplaints',
        alternateName: 'FOS Complaints Intelligence',
        url: absoluteUrl('/'),
        description: metadata.description,
      },
      {
        '@type': 'SoftwareApplication',
        name: 'RegComplaints',
        alternateName: 'FOS Complaints Intelligence',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: absoluteUrl('/'),
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/InStock',
        },
        featureList: [
          'Source-backed public complaints intelligence',
          'Firm and product comparison',
          'Complaints workspace',
          'Board-ready reporting',
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <MarketingHeader />
      <main className="overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:px-8">
          <PublicStatusBanner status={snapshot.status} />
        </div>
        <HomepageHero snapshot={snapshot} />
        <LiveProofStrip metrics={snapshot.liveProof} updatedAt={snapshot.updatedAt} />
        <PhaseGrid steps={snapshot.storySteps} />
        <AudienceSplit links={snapshot.featuredLinks} audienceCards={snapshot.audienceCards} />
      </main>
      <FooterCta workspaceHref={workspaceHref} />
    </div>
  );
}
