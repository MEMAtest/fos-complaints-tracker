import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/insights/seo';
import { getInsightsLandingData } from '@/lib/insights/repository';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { CheckEstimatorPage } from './check-estimator-page';

export const metadata: Metadata = {
  title: 'Complaint Outcome Estimator | FOS Complaints Intelligence',
  description:
    'Instantly check FOS complaint upheld rates by product, root cause, and firm. Backed by live public Financial Ombudsman decisions.',
  alternates: { canonical: absoluteUrl('/check') },
  openGraph: {
    title: 'Complaint Outcome Estimator | FOS Complaints Intelligence',
    description:
      'Instantly check FOS complaint upheld rates by product, root cause, and firm. Backed by live public Financial Ombudsman decisions.',
    url: absoluteUrl('/check'),
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Complaint Outcome Estimator',
    description:
      'Instantly check FOS complaint upheld rates by product, root cause, and firm.',
  },
};

export default async function CheckPage() {
  const landing = await getInsightsLandingData();
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'FOS Complaint Outcome Estimator',
        url: absoluteUrl('/check'),
        description: String(metadata.description),
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'GBP',
          availability: 'https://schema.org/InStock',
        },
        featureList: [
          'Complaint upheld rate estimation',
          'Firm vs sector comparison',
          'Top precedents analysis',
          'Outcome breakdown visualisation',
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <MarketingHeader />
      <main className="overflow-hidden">
        <CheckEstimatorPage
          liveStats={{
            publishedDecisions: landing.metrics[0]?.value || 'Live',
            publicPages: landing.metrics[1]?.value || 'Live',
            upheldRate: landing.metrics[2]?.value || 'Live',
            latestYear: landing.metrics[3]?.value || 'Current',
            featuredLinks: landing.featured.slice(0, 3).map((item) => ({ title: item.title, href: item.href })),
          }}
        />
      </main>
    </div>
  );
}
