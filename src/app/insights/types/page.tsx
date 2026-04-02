import type { Metadata } from 'next';
import { InsightArchiveList } from '@/components/insights/archive-list';
import { getPublishedTypeInsightsState } from '@/lib/insights/repository';
import { absoluteUrl } from '@/lib/insights/seo';

export const metadata: Metadata = {
  title: 'Complaint theme analysis | FOS Insights',
  description: 'Browse public complaint-theme analysis pages built from the root-cause tagging layer in the FOS corpus.',
  alternates: { canonical: absoluteUrl('/insights/types') },
};

export default async function InsightTypesPage() {
  const { items, status } = await getPublishedTypeInsightsState();
  return (
    <InsightArchiveList
      title="Complaint theme analysis"
      description="Browse public complaint-theme pages built from the root-cause tagging layer in the published Financial Ombudsman decisions corpus. These pages act as the closest durable complaint-type taxonomy available in the dataset."
      items={items}
      status={status}
      placeholder="Search complaint themes"
      variant="types"
    />
  );
}
