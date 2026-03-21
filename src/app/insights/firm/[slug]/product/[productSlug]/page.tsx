import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getFirmProductInsightPage } from '@/lib/insights/repository';

export async function generateMetadata({ params }: { params: { slug: string; productSlug: string } }): Promise<Metadata> {
  const page = await getFirmProductInsightPage(params.slug, params.productSlug);
  return page ? buildInsightMetadata(page) : {};
}

export default async function InsightFirmProductDetailPage({ params }: { params: { slug: string; productSlug: string } }) {
  const page = await getFirmProductInsightPage(params.slug, params.productSlug);
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
