import type { Metadata } from 'next';
import { InsightArchiveList } from '@/components/insights/archive-list';
import { getPublishedFirmInsights } from '@/lib/insights/repository';
import { absoluteUrl } from '@/lib/insights/seo';

export const metadata: Metadata = {
  title: 'Firm complaint analysis | FOS Insights',
  description: 'Browse public complaint analysis pages for firms appearing in the Financial Ombudsman decision corpus.',
  alternates: { canonical: absoluteUrl('/insights/firms') },
};

export default async function InsightFirmsPage() {
  const items = await getPublishedFirmInsights();
  return (
    <InsightArchiveList
      title="Firm complaint analysis"
      description="Public firm-by-firm analysis pages built from published Financial Ombudsman decisions, covering complaint volume, product mix, upheld-rate context, complaint themes, and representative cases."
      items={items}
      placeholder="Search firms"
      variant="firms"
    />
  );
}
