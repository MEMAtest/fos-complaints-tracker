import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/insights/seo';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { CheckEstimatorPage } from './check-estimator-page';

export const metadata: Metadata = {
  title: 'Complaint Outcome Estimator | FOS Complaints Intelligence',
  description:
    'Instantly check FOS complaint upheld rates by product, root cause, and firm. Backed by 386,000+ decisions.',
  alternates: { canonical: absoluteUrl('/check') },
  openGraph: {
    title: 'Complaint Outcome Estimator | FOS Complaints Intelligence',
    description:
      'Instantly check FOS complaint upheld rates by product, root cause, and firm. Backed by 386,000+ decisions.',
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

export default function CheckPage() {
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
    <div className="min-h-screen bg-[#f6f8fc] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <MarketingHeader />
      <main className="overflow-hidden">
        <CheckEstimatorPage />
      </main>
    </div>
  );
}
