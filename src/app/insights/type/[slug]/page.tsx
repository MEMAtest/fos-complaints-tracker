import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { InsightUnavailable } from '@/components/insights/insight-unavailable';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getTypeInsightPage } from '@/lib/insights/repository';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const page = await getTypeInsightPage(slug);
    return page ? buildInsightMetadata(page) : {};
  } catch {
    return { title: 'Complaint theme temporarily unavailable', robots: { index: false } };
  }
}

export default async function InsightTypeDetailPage({ params }: PageProps) {
  const { slug } = await params;
  let page;
  try {
    page = await getTypeInsightPage(slug);
  } catch (error) {
    console.warn(`[insights-page-degraded] type:${slug}: ${error instanceof Error ? error.message : String(error)}`);
    return <InsightUnavailable label="Complaint-theme analysis" />;
  }
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
