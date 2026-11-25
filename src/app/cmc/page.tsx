import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/insights/seo';
import { getWorkspaceEntryHref } from '@/lib/marketing/config';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { FooterCta } from '@/components/marketing/footer-cta';
import { CmcLandingClient } from '@/components/cmc/cmc-landing-client';

export const metadata: Metadata = {
  title: 'RegComplaints for CMCs & Claims Handling | Evidence-Led FOS Intelligence',
  description:
    'Published Financial Ombudsman intelligence for claims management companies (CMCs), financial claims solicitors, and insurance claims-handling teams. Model 2026/27 £260/£80 FOS fees, support CMCOB 2.1 merits review, and address FCA claims-handling expectations.',
  alternates: { canonical: absoluteUrl('/cmc') },
  openGraph: {
    title: 'RegComplaints for CMCs & Claims Handling | Evidence-Led FOS Intelligence',
    description:
      'Stronger claims, better evidence, and defensible claims handling backed by 395,692+ published Financial Ombudsman decisions.',
    url: absoluteUrl('/cmc'),
    siteName: 'RegComplaints',
    type: 'website',
    images: [
      {
        url: absoluteUrl('/images/brand/regcomplaints-og.png'),
        width: 1200,
        height: 630,
        alt: 'RegComplaints for CMCs & Claims Handling',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RegComplaints for CMCs & Claims Handling',
    description:
      'Evidence-led FOS precedent research, 2026/27 fee savings modelling, CMCOB 2.1 merits review, and FCA claims-handling oversight.',
    images: [absoluteUrl('/images/brand/regcomplaints-og.png')],
  },
};

export default function CmcLandingPage() {
  const workspaceHref = getWorkspaceEntryHref();
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'RegComplaints for CMCs & Claims Handling',
    url: absoluteUrl('/cmc'),
    description: metadata.description,
    about: [
      'Claims Management Companies (CMCs)',
      'FCA CMCOB 2.1',
      'Financial Ombudsman Service 2026/27 Representative Case Fees',
      'FCA Insurance Claims Handling Review',
    ],
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <MarketingHeader />
      <main>
        <CmcLandingClient workspaceHref={workspaceHref} />
      </main>
      <FooterCta workspaceHref={workspaceHref} />
    </div>
  );
}
