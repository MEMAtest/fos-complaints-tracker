import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getYearProductInsightPage } from '@/lib/insights/repository';

type PageProps = { params: Promise<{ year: string; productSlug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year, productSlug } = await params;
  const page = await getYearProductInsightPage(Number(year), productSlug);
  return page ? buildInsightMetadata(page) : {};
}

export default async function InsightYearProductDetailPage({ params }: PageProps) {
  const { year, productSlug } = await params;
  const page = await getYearProductInsightPage(Number(year), productSlug);
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
