import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { InsightUnavailable } from '@/components/insights/insight-unavailable';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getFirmProductInsightPage } from '@/lib/insights/repository';

type PageProps = { params: Promise<{ slug: string; productSlug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;
  try {
    const page = await getFirmProductInsightPage(slug, productSlug);
    return page ? buildInsightMetadata(page) : {};
  } catch {
    return { title: 'Firm product analysis temporarily unavailable', robots: { index: false } };
  }
}

export default async function InsightFirmProductDetailPage({ params }: PageProps) {
  const { slug, productSlug } = await params;
  let page;
  try {
    page = await getFirmProductInsightPage(slug, productSlug);
  } catch (error) {
    console.warn(`[insights-page-degraded] firm-product:${slug}:${productSlug}: ${error instanceof Error ? error.message : String(error)}`);
    return <InsightUnavailable label="Firm and product complaint analysis" />;
  }
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
