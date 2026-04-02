import type { Metadata } from 'next';
import { InsightArchiveList } from '@/components/insights/archive-list';
import { getPublishedYearProductInsightsState } from '@/lib/insights/repository';
import { absoluteUrl } from '@/lib/insights/seo';

export const metadata: Metadata = {
  title: 'Year and product complaint analysis | FOS Insights',
  description: 'Browse curated public complaint analysis pages for high-signal year and product combinations in the Financial Ombudsman corpus.',
  alternates: { canonical: absoluteUrl('/insights/year-products') },
};

export default async function InsightYearProductsPage() {
  const { items, status } = await getPublishedYearProductInsightsState();
  return (
    <InsightArchiveList
      title="Year and product complaint analysis"
      description="Curated public cross-pages for the strongest year and product combinations in the published Financial Ombudsman decision corpus. These pages are published only when the combination has enough data volume to support a useful, non-thin analysis."
      items={items}
      status={status}
      placeholder="Search years and products"
      variant="year-products"
    />
  );
}
