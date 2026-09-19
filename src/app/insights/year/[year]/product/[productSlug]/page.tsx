import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { InsightUnavailable } from '@/components/insights/insight-unavailable';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getYearProductInsightPage } from '@/lib/insights/repository';

type PageProps = { params: Promise<{ year: string; productSlug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year, productSlug } = await params;
  try {
    const page = await getYearProductInsightPage(Number(year), productSlug);
    return page ? buildInsightMetadata(page) : {};
  } catch {
    return { title: `${year} product analysis temporarily unavailable`, robots: { index: false } };
  }
}

export default async function InsightYearProductDetailPage({ params }: PageProps) {
  const { year, productSlug } = await params;
  let page;
  try {
    page = await getYearProductInsightPage(Number(year), productSlug);
  } catch (error) {
    console.warn(`[insights-page-degraded] year-product:${year}:${productSlug}: ${error instanceof Error ? error.message : String(error)}`);
    return <InsightUnavailable label={`${year} product complaint analysis`} />;
  }
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
