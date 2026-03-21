import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getProductInsightPage } from '@/lib/insights/repository';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await getProductInsightPage(params.slug);
  return page ? buildInsightMetadata(page) : {};
}

export default async function InsightProductDetailPage({ params }: { params: { slug: string } }) {
  const page = await getProductInsightPage(params.slug);
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
