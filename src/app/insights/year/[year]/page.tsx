import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { InsightUnavailable } from '@/components/insights/insight-unavailable';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getYearInsightPage } from '@/lib/insights/repository';

type PageProps = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year } = await params;
  try {
    const page = await getYearInsightPage(Number(year));
    return page ? buildInsightMetadata(page) : {};
  } catch {
    return { title: `${year} FOS analysis temporarily unavailable`, robots: { index: false } };
  }
}

export default async function InsightYearDetailPage({ params }: PageProps) {
  const { year } = await params;
  let page;
  try {
    page = await getYearInsightPage(Number(year));
  } catch (error) {
    console.warn(`[insights-page-degraded] year:${year}: ${error instanceof Error ? error.message : String(error)}`);
    return <InsightUnavailable label={`${year} Financial Ombudsman analysis`} />;
  }
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
