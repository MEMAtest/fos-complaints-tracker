import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { InsightUnavailable } from '@/components/insights/insight-unavailable';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getFirmInsightPage } from '@/lib/insights/repository';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const page = await getFirmInsightPage(slug);
    return page ? buildInsightMetadata(page) : {};
  } catch {
    return { title: 'Firm analysis temporarily unavailable', robots: { index: false } };
  }
}

export default async function InsightFirmDetailPage({ params }: PageProps) {
  const { slug } = await params;
  let page;
  try {
    page = await getFirmInsightPage(slug);
  } catch (error) {
    console.warn(`[insights-page-degraded] firm:${slug}: ${error instanceof Error ? error.message : String(error)}`);
    return <InsightUnavailable label="Firm complaint analysis" />;
  }
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
