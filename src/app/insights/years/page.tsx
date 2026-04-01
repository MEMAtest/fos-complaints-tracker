import type { Metadata } from 'next';
import { InsightArchiveList } from '@/components/insights/archive-list';
import { getPublishedYearInsights } from '@/lib/insights/repository';
import { absoluteUrl } from '@/lib/insights/seo';

export const metadata: Metadata = {
  title: 'Annual FOS complaint analysis | FOS Insights',
  description: 'Browse annual Financial Ombudsman complaint analysis pages by year.',
  alternates: { canonical: absoluteUrl('/insights/years') },
};

export default async function InsightYearsPage() {
  const items = await getPublishedYearInsights();
  return (
    <InsightArchiveList
      title="Annual ombudsman complaint analysis"
      description="Browse year-by-year public analysis of the Financial Ombudsman decisions corpus, including upheld-rate context, leading firms, product concentration, complaint themes, and representative cases."
      items={items}
      placeholder="Search years"
      variant="years"
    />
  );
}
