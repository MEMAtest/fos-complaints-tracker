import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getYearProductInsightPage } from '@/lib/insights/repository';

export async function generateMetadata({ params }: { params: { year: string; productSlug: string } }): Promise<Metadata> {
  const page = await getYearProductInsightPage(Number(params.year), params.productSlug);
  return page ? buildInsightMetadata(page) : {};
}

export default async function InsightYearProductDetailPage({ params }: { params: { year: string; productSlug: string } }) {
  const page = await getYearProductInsightPage(Number(params.year), params.productSlug);
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
