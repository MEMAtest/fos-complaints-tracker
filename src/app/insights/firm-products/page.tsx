import type { Metadata } from 'next';
import { InsightArchiveList } from '@/components/insights/archive-list';
import { getPublishedFirmProductInsights } from '@/lib/insights/repository';
import { absoluteUrl } from '@/lib/insights/seo';

export const metadata: Metadata = {
  title: 'Firm and product complaint analysis | FOS Insights',
  description: 'Browse curated public complaint analysis pages for strong firm and product combinations in the Financial Ombudsman corpus.',
  alternates: { canonical: absoluteUrl('/insights/firm-products') },
};

export default async function InsightFirmProductsPage() {
  const items = await getPublishedFirmProductInsights();
  return (
    <InsightArchiveList
      title="Firm and product complaint analysis"
      description="Curated public cross-pages for firms with strong product-specific complaint footprints in the published Financial Ombudsman decision corpus. These pages are published only when the firm-product slice is large enough to support a strong public analysis."
      items={items}
      placeholder="Search firms and products"
    />
  );
}
