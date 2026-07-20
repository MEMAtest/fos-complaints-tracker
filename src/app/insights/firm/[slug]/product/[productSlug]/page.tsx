import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getFirmProductInsightPage } from '@/lib/insights/repository';

type PageProps = { params: Promise<{ slug: string; productSlug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const page = await getFirmProductInsightPage(slug, productSlug);
  return page ? buildInsightMetadata(page) : {};
}

export default async function InsightFirmProductDetailPage({ params }: PageProps) {
  const { slug, productSlug } = await params;
  const page = await getFirmProductInsightPage(slug, productSlug);
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
