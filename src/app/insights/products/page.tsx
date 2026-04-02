import type { Metadata } from 'next';
import { InsightArchiveList } from '@/components/insights/archive-list';
import { getPublishedProductInsightsState } from '@/lib/insights/repository';
import { absoluteUrl } from '@/lib/insights/seo';

export const metadata: Metadata = {
  title: 'Product complaint analysis | FOS Insights',
  description: 'Browse public complaint analysis pages for product categories in the Financial Ombudsman decision corpus.',
  alternates: { canonical: absoluteUrl('/insights/products') },
};

export default async function InsightProductsPage() {
  const { items, status } = await getPublishedProductInsightsState();
  return (
    <InsightArchiveList
      title="Product complaint analysis"
      description="Public product-level complaint analysis pages for the Financial Ombudsman corpus, with outcome context, top firms, complaint themes, precedent signals, and representative published decisions."
      items={items}
      status={status}
      placeholder="Search products"
      variant="products"
    />
  );
}
